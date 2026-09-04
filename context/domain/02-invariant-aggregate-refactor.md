---
title: 'Invariant & aggregate refactor plan — Task text non-emptiness'
created: 2026-09-04
type: refactor-plan
---

# Niezmiennik i agregat-strażnik — tekst tasku nigdy nie jest pusty

**Produkt tego dokumentu to PLAN, nie implementacja.** Żaden kod nie został zmieniony.

## Krok 1 — Zidentyfikowane niezmienniki

Z `context/domain/01-domain-distillation.md` (Krok 3) i bezpośredniej lektury kodu:

1. **Tekst tasku nigdy nie jest pusty/białoznakowy** — dorozumiane z `context/foundation/prd.md:124` („an ordered list of task strings" — pusty string nie jest „distinct actionable item"), egzekwowane w dwóch niezależnych miejscach.
2. **Użytkownik widzi/modyfikuje wyłącznie własne taski** — `prd.md:130`, egzekwowane przez Postgres RLS, potwierdzone `backend/test/idor.test.ts`.
3. **Dokładnie jedno źródło prawdy o stanie sesji** — dorozumiane, egzekwowane strukturalnie przez `AuthContext`, ale port bywa omijany (patrz `03-anti-corruption-layer.md`).

## Krok 2 — Klasyfikacja i wybór #1

| Niezmiennik                | (a) Rdzeniowość                    | (b) Rozsmarowanie                                                                                                                                                                                                                           | (c) Egzekwowanie                                                                 |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Tekst tasku niepusty    | Wysoka — dotyczy `Task`, bytu Core | 2 niezależne miejsca (`ai/extract.ts:51`, `routes/tasks.ts:50-51`), **plus trzecie: żaden insert nie ma gwarancji na poziomie typu** (`texts: string[]` w `insertTasks` — patrz `plan.md` z L4 — nie wyklucza pustego stringa w sygnaturze) | Naruszalne: dwie kopie reguły mogą się rozjechać przy zmianie jednej bez drugiej |
| 2. Izolacja per-user (RLS) | Wysoka                             | 1 miejsce (polityka RLS w Supabase)                                                                                                                                                                                                         | Egzekwowane i **przetestowane na żywej sieci** — najsilniejszy z trzech          |
| 3. Jedno źródło sesji      | Średnia (Supporting, nie Core)     | 1 „miejsce" strukturalnie (`AuthContext`), ale bywa omijane w praktyce                                                                                                                                                                      | Deklarowane, ale naruszalne — patrz ACL                                          |

**Wybór: #1 — tekst tasku niepusty.** Jest jednocześnie najbardziej rdzeniowy (dotyczy bytu Core, `Task`) i najsłabiej egzekwowany (dwie niezależne kopie reguły, zero typu, który by ją wymuszał strukturalnie). #2 jest silniejszy i sprawdzony — nie wymaga interwencji. #3 jest realny, ale to Supporting, nie Core, i ma osobny, właściwy dla siebie wzorzec naprawy (ACL, nie agregat) — patrz `03-anti-corruption-layer.md`.

## Krok 3 — Diagnoza

Reguła dziś żyje w dwóch miejscach, każde z inną formą egzekwowania:

- **`backend/src/ai/extract.ts:51`**: `parsed.tasks.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)` — ekstrakcja z Claude przechodzi przez `.trim()` + `.filter(Boolean)`, więc pusty/białoznakowy string nigdy nie dotrze dalej z tej ścieżki.
- **`backend/src/routes/tasks.ts:50-51`**: `const texts = raw.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean); if (texts.length === 0) return c.json({ error: 'provide a non-empty `text`or`texts`' }, 400);` — ręczny endpoint `POST /tasks` ma swoją, osobno napisaną, niemal identyczną logikę.
- **`backend/src/routes/transcribe.ts:36-53`**: **nie waliduje niczego samodzielnie** — ufa, że `extractTasks()` już to zrobiło. To działa dziś (bo `extract.ts:51` faktycznie filtruje), ale nic w typie zwracanym przez `extractTasks(): Promise<string[]>` tego nie gwarantuje — sygnatura pozwala na dowolny `string[]`, łącznie z pustymi elementami. Ktoś zmieniający `extract.ts` (np. usuwający `.filter(Boolean)` przy refaktorze promptu) złamałby regułę cicho, bo `routes/transcribe.ts` nigdy sam jej nie sprawdza.
- **Klient nie waliduje wcale** — `PATCH /tasks/:id` (`tasks.ts:70-73`) sprawdza niepusty `text` przy edycji, ale to trzecia, znowu osobna kopia tej samej reguły.

Żadna warstwa nie jest jedynym strażnikiem. Reguła jest „rozsmarowana" po trzech miejscach (ekstrakcja, POST /tasks, PATCH /tasks/:id), z których jedno (`transcribe.ts`) polega wyłącznie na tym, że sąsiad (`extract.ts`) się nie zmieni.

## Krok 4 — Projekt agregatu-strażnika

**Zbieg okoliczności wart wykorzystania**: `context/changes/refactor-opportunities/plan.md` (L4, już zaplanowane, jeszcze niezaimplementowane) tworzy `backend/src/db/tasks.ts::insertTasks(supabase, texts)` jako jedyne miejsce insertu do `tasks` — dokładnie z innego powodu (usunięcie duplikacji C1). To jest naturalna granica agregatu dla tego niezmiennika: zamiast dodawać czwarte, osobne miejsce walidacji, ten sam punkt, który L4 już centralizuje dla insertu, powinien też być jedynym miejscem walidacji.

- **Rozszerzona sygnatura** (rozszerzenie planu L4, nie nowy byt): `insertTasks(supabase, texts: string[])` **rzuca nazwany błąd domenowy** (np. `EmptyTaskTextError`), jeśli po `.trim()` którykolwiek element jest pusty, zamiast cicho pomijać (dzisiejsze zachowanie w `extract.ts`/`tasks.ts` to _filtrowanie_, nowe zachowanie to _odrzucenie z jawnym błędem_ — patrz „Before/after" niżej dla uzasadnienia zmiany zachowania).
- **Precondition**: `texts` niepuste jako tablica (co najmniej jeden element po trim) i każdy element niepusty po trim.
- **Wywołujący** (`routes/tasks.ts`, `routes/transcribe.ts`) łapie `EmptyTaskTextError` i mapuje na istniejący kształt odpowiedzi 400/422 — bez zmiany kontraktu HTTP.
- **`PATCH /tasks/:id`** (edycja pojedynczego tasku) to osobna operacja (update, nie insert) — poza zakresem `insertTasks`, ale powinna wołać tę samą walidującą funkcję pomocniczą (np. wydzielić `assertNonEmptyText(text: string): string` używaną przez oba miejsca), żeby nie zostawić trzeciej kopii reguły.

## Krok 5 — Before / after, plan, testy

**Before:**

- `extract.ts:51` — filtruje ciszej (nie błąd, po prostu pomija)
- `tasks.ts:50-51` — waliduje i zwraca 400, jeśli **wszystkie** elementy puste (nie odrzuca częściowo pustych — `['zrób pranie', '']` przejdzie jako `['zrób pranie']`, cicho tracąc informację, że drugi element był pusty)
- `tasks.ts:70-73` (PATCH) — trzecia, osobna kopia

**After:**

- Jedna funkcja pomocnicza `assertNonEmptyText` używana przez `insertTasks` (dla batch) i `PATCH` (dla pojedynczej edycji)
- Zachowanie przy częściowo pustych elementach staje się **jawną decyzją do podjęcia w planie implementacji** (dziś ciche filtrowanie w `extract.ts`, ale `tasks.ts` już dziś różni się subtelnie — to jest dokładnie ten rodzaj cichej niespójności, który agregat ma wyeliminować, nie tylko przenieść)

**Plan faz (do wykonania jako osobna zmiana, `/10x-new`/`/10x-plan`, po tym jak L4's `refactor-opportunities` wyląduje):**

1. Test-first: charakteryzujący test dla dzisiejszego zachowania `extract.ts`/`tasks.ts` na pustych/białoznakowych elementach (utrwala _obecne_, nie _docelowe_ zachowanie — zgodnie z regułą „dodaj test, zanim dotkniesz" z M4L4).
2. Dodać `assertNonEmptyText` + `EmptyTaskTextError` jako nowy, odosobniony kod (nie dotyka jeszcze wywołań).
3. Wpiąć w `insertTasks` (przy okazji L4's C1) i w `PATCH /tasks/:id`.
4. Usunąć zduplikowaną walidację z `tasks.ts:50-51` i `ai/extract.ts:51` (zamienić na wywołanie wspólnej funkcji lub usunąć, jeśli `insertTasks` już to gwarantuje).

**Przypadki testowe (legalne/nielegalne):**

- Legalne: `['zrób pranie']`, `['zrób pranie', 'zadzwoń do mamy']`
- Nielegalne: `['']`, `['   ']`, `['zrób pranie', '']` (częściowo puste — zachowanie do jawnej decyzji w planie, nie tutaj)
- Brzegowe: tablica pusta `[]` (dziś `transcribe.ts:42-45` ma na to osobną, poprawną obsługę — „zero tasks" to explicit 200, nie błąd; nie mylić z „lista z pustym elementem")

## Ograniczenia

- Cytaty zweryfikowane bezpośrednim odczytem plików w tej sesji (`extract.ts`, `tasks.ts`, `transcribe.ts`) — nie przez ast-grep w tym dokumencie (to plan, nie research zakończony metrykami; L3/L4's `research.md` już mają pełną weryfikację ast-grep dla powiązanych twierdzeń o duplikacji insertu).
- Ten plan zakłada, że L4's `refactor-opportunities/plan.md` (C1: `insertTasks()`) wyląduje first — jeśli kolejność się zmieni, agregat i tak może powstać samodzielnie, tylko traci naturalny punkt zaczepienia.
