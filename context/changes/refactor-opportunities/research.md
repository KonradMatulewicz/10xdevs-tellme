---
date: 2026-09-04T20:12:17+02:00
researcher: Claude (10x-research)
git_commit: 626f4cfc54183097882e380ca9f5478fcde96ed8
branch: fix/claude-review-track-progress
repository: 10xDEVS (Tellme)
topic: 'Refactor opportunities ranking, sourced from voice-task-pipeline/research.md (M4L4)'
tags: [research, codebase, refactor-ranking, backend, supabase]
status: complete
last_updated: 2026-09-04
last_updated_by: Claude (10x-research)
---

# Research: Refactor opportunities — ranking

**Date**: 2026-09-04T20:12:17+02:00
**Researcher**: Claude (10x-research)
**Git Commit**: 626f4cfc54183097882e380ca9f5478fcde96ed8
**Branch**: fix/claude-review-track-progress
**Repository**: 10xDEVS (Tellme)

## Research Question

Które problemy z `context/changes/voice-task-pipeline/research.md` (sekcja Technical debt) warto naprawić, w jakim docelowym kształcie i w jakiej kolejności — eksploracja, nie decyzja.

## Klasyfikacja kandydatów (na starcie, do audytu)

| #   | Problem z `voice-task-pipeline/research.md`                                         | Kandydat? | Uzasadnienie                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Zduplikowany insert do `tasks` (`routes/transcribe.ts` / `routes/tasks.ts`)         | **TAK**   | Naprawa zmienia strukturę kodu (nowa funkcja/moduł współdzielony)                                                                                                                             |
| C2  | Zduplikowany `TaskStatus`/`TASK_STATUSES` (`src/types.ts` / `backend/src/types.ts`) | **TAK**   | Naprawa wymaga nowego mechanizmu synchronizacji/kontraktu                                                                                                                                     |
| C3  | Brak transakcyjności przy częściowej awarii (insert po udanym Whisper+Claude)       | **TAK**   | Naprawa zmienia przepływ sterowania w handlerze                                                                                                                                               |
| C4  | Brak generyka `Database` na kliencie Supabase                                       | **TAK**   | Naprawa zmienia sygnaturę i typy w całym module dostępu do danych                                                                                                                             |
| —   | Zero testów na 5/6 plików pipeline'u                                                | **NIE**   | To luka w pokryciu, nie problem strukturalny — już nazwana i zaplanowana jako `test-plan.md` Faza 2. Wejście do oceny wykonalności (patrz C1: bezpieczeństwo refaktoru), nie osobny kandydat. |
| —   | Usunięta animacja Reanimated w `record-button.tsx` (iOS freeze)                     | **NIE**   | To bugfix/dokończenie znanego workaroundu, nie problem strukturalny — poza zakresem tej lekcji (M4L4 nie obejmuje debugowania, to M5).                                                        |

Dodatkowe odkrycie spoza pierwotnej listy, ale krytyczne dla oceny wykonalności każdego kandydata: **żaden job CI nie typechecku­je `backend/src`.** Root `tsconfig.json:12` jawnie wyklucza `backend`; `backend-tests` w CI woła tylko `vitest run`, nigdy własny skrypt `npm run typecheck` z `backend/package.json`. To nie jest osobny kandydat refaktoryzacji (nie zmienia struktury kodu appki), ale jest tanim, wysokowartościowym prerekwizytem — patrz sekcja rankingu.

## Per-kandydat

### C1 — Zduplikowany insert do `tasks`

**Obecny kształt (evidence):** `backend/src/routes/transcribe.ts:49-52` i `backend/src/routes/tasks.ts:54-57` — identyczny blok `supabase.from('tasks').insert(texts.map(text => ({ text }))).select()`. Cały `backend/src/` to 8 plików; nie istnieje żaden `store/`, `repository/`, `db/` ani inny moduł dostępu do danych (potwierdzone przez pełny listing katalogu + grep). Jedyne współdzielone jest samo połączenie (`SupabaseClient` z `middleware/auth.ts`), nie zapytanie.

**Werdykt intencjonalności:** **przypadkowe/nierewidowane.** `tasks.ts` powstał w commicie `200a433` (2026-06-12 12:51), `transcribe.ts` 37 minut później w `6876ddc` — insert skopiowany, nie wydzielony. Każdy plik ma dokładnie jeden commit w całej historii — nigdy nie wrócono do tego miejsca. Żaden komentarz nie uzasadnia braku wspólnej funkcji.

**Wykonalność:** Najmniejszy odwracalny krok — jedna funkcja `insertTasks(supabase, texts)` w nowym module (np. `backend/src/db/tasks.ts`), wołana z obu routerów. **Bezpieczne dla istniejących testów**: `fake-supabase.ts` jawnie nie inspekcjonuje argumentów `.insert()` (komentarz w pliku to przyznaje), więc refaktor nie może przypadkiem zepsuć `tasks.test.ts`. **Ale ta sama własność to podwójna krawędź**: skoro fake nie sprawdza argumentów, CI też nie złapie _błędnie_ wykonanej ekstrakcji (np. literówki w nazwie kolumny) — bezpieczeństwo testów działa tylko w jedną stronę (nie zepsuje starych testów, ale nie zweryfikuje nowego kodu).

### C2 — Zduplikowany `TaskStatus`/`TASK_STATUSES`

**Obecny kształt (evidence):** `src/types.ts:1-2` i `backend/src/types.ts:22-23` — identyczne. Potwierdzone: brak `workspaces` w root `package.json`, brak `pnpm-workspace.yaml`/`turbo.json`/`nx.json` gdziekolwiek w repo. To dwa w pełni niezależne projekty npm (RN app przy rootcie, Worker w `backend/`) bez żadnego mechanizmu współdzielenia kodu.

**Werdykt intencjonalności:** **przypadkowe/nierewidowane.** `backend/src/types.ts` powstał pierwszy (`200a433`), `src/types.ts` dwa dni później (`831452a`) — kopia, nie import. Żaden komentarz, żaden fragment `context/foundation/tech-stack.md` nie adresuje strategii współdzielenia typów między RN a Workerem — dokument uzasadnia wybór stacku, nie tę konkretną granicę.

**Wykonalność (trzy opcje, realnie ocenione pod ten toolchain):**

- **(a) Skrypt kontraktowy** porównujący obie tablice przez `deep-equal`, uruchamiany jako nowy krok CI (nie w Jest ani w Vitest — żaden z obu runnerów nie obejmuje obu katalogów naraz). Efekt: **niski-średni koszt**, ~10 linii skryptu + jeden nowy krok CI. Nic takiego dziś nie istnieje.
- **(b) Codegen** jednego pliku z drugiego. **Średni koszt** — `Task` (interfejs) różni się między plikami, więc to nie kopia całego pliku, tylko blok wydzielony znacznikami. Backend ma już `typegen` (`wrangler types`), ale generuje typy bindingów Workera, nie typy domenowe — nie da się tego rozszerzyć bez dodatkowej logiki.
- **(c) Komentarz „keep in sync"** wskazujący na odpowiednik w drugim pliku. **Trywialny koszt, zero automatycznego egzekwowania** — CI nigdy nie złapie dryfu.
- Brak istniejącej infrastruktury (hook pre-commit, reguła lint) do doczepienia którejkolwiek opcji — każda wymaga nowego kroku od zera.

### C3 — Brak transakcyjności przy częściowej awarii

**Obecny kształt (evidence):** `backend/src/routes/transcribe.ts:46-53` — między udaną ekstrakcją a próbą insertu nie ma żadnego logowania ani zapisu pośredniego. Brak jakiegokolwiek mechanizmu outbox/kolejki/draft w całym `backend/` (potwierdzone grepem) i brak logowania w ogóle w `backend/src` (zero wystąpień `console.*`).

**Werdykt intencjonalności:** **unknown/skłaniające się ku przypadkowemu — najsłabszy dowód z czterech.** Plik ma dokładnie jeden commit w historii. Komentarz przy handlerze (`transcribe.ts:8-12`) mówi o „jasnym stanie błędu", nie o zachowaniu już wykonanej pracy. PRD (`prd.md:116-117`) ma zasadę prywatności o nieprzechowywaniu surowego audio (nie dotyczy tego przypadku — to już wyekstrahowany tekst) i zasadę o jasnym stanie błędu przy problemach z siecią (pasuje częściowo, ale nie mówi nic o retry/cache). Żadne źródło nie dyskutuje wprost tego konkretnego kompromisu. Ten sam brak transakcyjności występuje symetrycznie w `tasks.ts` — spójna konwencja, nie odosobniony błąd, ale spójność ≠ świadoma decyzja.

**Wykonalność:** Najmniejszy krok — `console.error('task-insert-failed', { texts, transcript, error })` w gałęzi błędu (`transcribe.ts:53`), jedna linia, w pełni odwracalna. Ograniczenie: `wrangler.toml` nie ma bloku `[observability]`, więc bez dodatkowej (osobnej, małej) zmiany konfiguracji log nie ma gdzie trwale wylądować poza aktywną sesją `wrangler tail`. Pełne rozwiązanie (tabela outbox + retry) to realna zmiana schematu — nieodwracalna w jednym kroku, poza zakresem „najmniejszego kroku".

### C4 — Brak generyka `Database` na kliencie Supabase

**Obecny kształt (evidence):** `backend/src/supabase.ts:15-20,27-32` — `createClient(...)` bez `<Database>`. Brak wygenerowanych typów schematu gdziekolwiek w repo (brak `database.types.ts`, brak `supabase/migrations/`). Supabase CLI nie jest zależnością w żadnym `package.json`.

**Werdykt intencjonalności:** **przypadkowe/nierewidowane.** Plik ma komentarz `LOAD-BEARING` (`supabase.ts:5-14`), ale dotyczy wyłącznie nadpisania `fetch` dla `workerd` — nie typowania. `context/foundation/infrastructure.md`'s rejestr ryzyk (7 pozycji) nie wymienia brakujących typów schematu ani razu.

**Wykonalność:** Generowanie typów wymaga `npx supabase gen types typescript` — bez lokalnych migracji (potwierdzone: brak `supabase/migrations/`) jedyna droga to `--project-id` przeciw żywemu projektowi Supabase, czyli zależność operacyjna, nie tylko kodowa. **Nieznane (inference, nie zweryfikowane):** czy dodanie generyka będzie czysto addytywne, czy ujawni istniejące niedopasowania typów (np. `(body as any).texts` w `tasks.ts:45`, nietypowany `patch: Record<string, unknown>` w `tasks.ts:69-84`) — realistycznie prawdopodobne, ale nie zweryfikowane bez faktycznego wygenerowania typów.

**Najostrzejsze pojedyncze odkrycie tego researchu:** nawet gdyby C4 ujawniło realne błędy typów, **CI by ich nie złapało** — bo, jak ustalono wyżej, żaden job nie uruchamia `tsc --noEmit` dla `backend/src`. To samo ograniczenie osłabia siatkę bezpieczeństwa dla wszystkich czterech kandydatów w częściach, które są czysto typowe.

## Refactor opportunities (ranking)

1. **C1 — wydzielić `insertTasks()` do wspólnej funkcji.** Najwyższa wartość przy najniższym koszcie: usuwa potwierdzoną duplikację, jest w pełni bezpieczne względem istniejących testów (nie zepsuje ich), i tworzy jedno miejsce, w którym przyszłe prace nad C3 (logowanie błędu insertu) i C4 (typowanie) będą musiały żyć tylko raz, nie dwa razy. Blast radius: 2 pliki w `backend/src/routes/` + 1 nowy moduł. Pierwszy krok-prerekwizyt: żaden — można zacząć od razu.

2. **Tani, szybki zysk niezależnie od rankingu — włączyć `backend` typecheck w CI.** Nie jest jednym z czterech nazwanych kandydatów (nie zmienia struktury appki), ale to jednolinijkowa zmiana w `.github/workflows/ci.yml` (dodać krok `npm run typecheck` do joba `backend-tests`, skrypt już istnieje w `backend/package.json:13`) o nieproporcjonalnie dużej wartości: to jedyna dźwignia, która realnie wzmacnia siatkę bezpieczeństwa pod C1, C3 i zwłaszcza C4. Rekomendacja: zrobić to przed, albo razem z, C4.

3. **C2 — lekki skrypt kontraktowy (opcja a) jako pierwszy krok.** Realny problem, ale bez dobrego darmowego rozwiązania — żadna z trzech opcji nie piggybackuje na istniejącej infrastrukturze. Opcja (a) daje automatyczne egzekwowanie przy najniższym koszcie spośród opcji, które w ogóle coś egzekwują. Blast radius: nowy plik skryptu + jeden krok CI, zero zmian w kodzie produkcyjnym. Pierwszy krok-prerekwizyt: żaden.

4. **C4 — dodać generyk `Database`, ale dopiero po #2.** Wartościowe (typowany insert/update zamyka część ryzyka z C1 na stałe), ale wymaga zależności operacyjnej (żywy projekt Supabase do `gen types`) i realnie może ujawnić dziś ukryte niedopasowania typów w `tasks.ts` — robienie tego bez włączonego backendowego typecheck w CI (#2) oznacza wysyłanie zmiany typów bez żadnej automatycznej weryfikacji. Pierwszy krok-prerekwizyt: #2 (włączony CI typecheck dla `backend/`).

5. **C3 — najpierw samo logowanie, nie pełna transakcyjność.** Najsłabszy dowód intencjonalności z czterech i najmniej dojrzała siatka bezpieczeństwa (zero testów na `transcribe.ts` w ogóle). Jednoliniowe `console.error` na gałęzi błędu to tani krok, ale jego wartość jest ograniczona bez skonfigurowanej trwałej obserwowalności (`wrangler.toml` `[observability]`) — bez tego log istnieje tylko podczas aktywnej sesji `wrangler tail`. Rekomendacja: potraktować jako część już zaplanowanej `test-plan.md` Fazy 2 („AI pipeline error-handling coverage"), nie jako osobny refaktor teraz.

### Odrzucone / nie-kandydaci

- **Zero testów na pipeline (5/6 plików)** — nie jest kandydatem refaktoryzacji z definicji (nie zmienia struktury kodu). Już nazwane i zaplanowane w `context/foundation/test-plan.md` jako ryzyko #1, Faza 2, status „not started". Ta zmiana go nie duplikuje.
- **Animacja Reanimated w `record-button.tsx`** — bugfix, nie problem strukturalny; poza zakresem tej lekcji (M4L4 nie obejmuje debugowania — to M5).

## Code References

- `backend/src/routes/transcribe.ts:49-52`, `backend/src/routes/tasks.ts:54-57` — duplikacja C1
- `src/types.ts:1-2`, `backend/src/types.ts:22-23` — duplikacja C2
- `backend/src/routes/transcribe.ts:46-53` — brak transakcyjności C3
- `backend/src/supabase.ts:15-20,27-32` — nietypowany klient C4
- `.github/workflows/ci.yml:10-30,32-67`, `tsconfig.json:12`, `backend/package.json:13` — luka w CI typecheck dla backendu
- `backend/test/support/fake-supabase.ts:13-31` — fake nie inspekcjonuje argumentów insert/update
- `context/foundation/infrastructure.md` (rejestr ryzyk, 7 pozycji) — brak wzmianki o typach schematu
- `context/foundation/prd.md:116-117` — zasady prywatności/błędów, nie dotyczą wprost C3

## Architecture Insights

Wszystkie cztery kandydaty łączy jeden wzorzec: powstały w bardzo krótkich, jednorazowych seriach commitów (repo ma 43 commity w 3 miesiące) i nigdy nie zostały rewidowane. To nie jest legacy w sensie „wielu autorów, sprzeczne decyzje" — to raczej „zbudowane szybko, działa, nikt jeszcze nie musiał wracać". Brak `store`/`repository` warstwy w backendzie jest przyczyną strukturalną, dla której C1 w ogóle mogło powstać tak łatwo — jeden plik z tą warstwą uczyniłby duplikację trudniejszą niż jej brak.

## Historical Context (from prior changes)

- `context/changes/voice-task-pipeline/research.md` — źródło wszystkich czterech kandydatów, traktowane jako dowód, nie wyprowadzane na nowo.
- `context/map/repo-map.md` — strefy ryzyka, z których wybrano pipeline głos→zadanie jako cel Deep Focus.

## Related Research

- `context/changes/voice-task-pipeline/research.md`

## Weryfikacja twierdzeń strukturalnych (ast-grep / grep)

| Twierdzenie                                                                                         | Metoda                                                   | Wynik                                                                                                                     | Werdykt          |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `backend/src` ma tylko 3 podkatalogi (`ai`, `middleware`, `routes`), brak `store`/`repository`/`db` | `find backend/src -type d`                               | dokładnie 3 podkatalogi, żaden nie pasuje do wzorca data-access                                                           | **potwierdzone** |
| Zero `console.*` w `backend/src`                                                                    | `grep -rn "console\." backend/src/`                      | brak wyników                                                                                                              | **potwierdzone** |
| Brak `supabase/migrations/` dla tego projektu                                                       | `find . -iname migrations` (poza `node_modules`/`tools`) | tylko wewnętrzne foldery migracji bibliotek klienckich Supabase w `node_modules` — nic w kodzie projektu                  | **potwierdzone** |
| Root `package.json` bez pola `workspaces`                                                           | `grep -n "workspaces" package.json`                      | brak wyników                                                                                                              | **potwierdzone** |
| `backend-tests` w CI nie wywołuje `npm run typecheck`, tylko `npm test`                             | odczyt `.github/workflows/ci.yml:32-67` w całości        | jedyne kroki to `npm ci` i `npm test` — brak jakiegokolwiek `typecheck`                                                   | **potwierdzone** |
| Root `tsconfig.json` jawnie wyklucza `backend`                                                      | `grep -n "exclude" -A3 tsconfig.json`                    | `"exclude": ["node_modules", "tools", "backend", "dist", ".expo/web-build"]`                                              | **potwierdzone** |
| `fake-supabase.ts` nie inspekcjonuje argumentów `insert`/`update`                                   | odczyt pliku, linie 10-24                                | komentarz wprost: „Arguments passed to chain methods are not inspected"; `insert: () => builder`, `update: () => builder` | **potwierdzone** |

Zero twierdzeń obalonych lub doprecyzowanych — ranking i werdykty intencjonalności pozostają bez zmian.

## Open Questions

- Czy dodanie generyka `Database` do klienta Supabase (C4) faktycznie ujawni istniejące niedopasowania typów w `tasks.ts` — nie zweryfikowane bez realnego wygenerowania typów (wymaga żywego projektu Supabase).
- `context/foundation/test-plan.md` samo jest częściowo nieaktualne względem stanu repo (opisuje brak testów backendu, które już istnieją) — wart osobnej aktualizacji, poza zakresem tej zmiany.
