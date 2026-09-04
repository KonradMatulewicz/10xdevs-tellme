---
title: '10xArchitect — Module 4 activity report (Tellme)'
created: 2026-09-04
type: architect-report
---

# Raport architektoniczny — moduł 4 (10xArchitect)

## 1. Opisane projekty

Jeden projekt przez cały moduł: **Tellme** (RN/Expo Router frontend w `src/`, Hono/Cloudflare Worker backend w `backend/`, Supabase jako auth+DB). Skala: 43 commity, ~3 miesiące, jeden autor, ~24 pliki `src/` + ~8 `backend/src/`. To nie jest legacy w klasycznym sensie (wielu autorów, sprzeczne decyzje) — to MVP zbudowane szybko, gdzie część obszarów nigdy nie została zrewidowana po pierwszym napisaniu. Metody z lekcji zastosowane w skali kalibrowanej w dół: bez rozbicia kwartalnego (za krótka historia), bez realnej mapy kontrybutorów (jeden autor), z `npx madge`/`npx ast-grep` zamiast trwałych zależności w `package.json`.

Artefakty: `repo-map.md` (L2), `voice-task-pipeline/research.md` (L3), `refactor-opportunities/{research,plan}.md` (L4), `context/domain/*.md` ×3 (L5).

## 2. Mapa projektu (z L2)

- **Strefa ryzyka #1**: pipeline głos→zadanie (`record-button.tsx` → `routes/transcribe.ts` → Whisper → Claude → Supabase insert) — jedyny obszar bez testów po obu stronach, mimo że jest rdzeniem produktu.
- **Lokalne centra**: `lib/auth.tsx` (jedyny punkt dostępu do sesji, fan-in 6, 46 partnerów współzmian), `app/(app)/index.tsx` (fan-out 10 — nagrywanie+lista+search+taby w jednym ekranie).
- **Realne powiązanie niewidoczne w grafie**: `TaskStatus`/`TASK_STATUSES` zduplikowany znak w znak między `src/types.ts` a `backend/src/types.ts`, zero importu — ani graf importów, ani współzmiany tego nie złapią.
- **Najważniejszy unknown**: czy produkcyjny Worker ma dziś komplet trzech sekretów poprawnie ustawionych — niesprawdzalne z samego repo.

## 3. Analiza ficzera (z L3)

**Badany przepływ**: pipeline głos→zadanie — wybrany bezpośrednio ze Strefy ryzyka #1 mapy.

**Feature overview (3-4 zdania)**: Nagranie trafia do Whisper (Cloudflare Workers AI), transkrypt do Claude (structured JSON output), wynik zapisywany do Supabase. Kluczowe znalezisko: lista zadań w UI **nie** jest aktualizowana z odpowiedzi `/transcribe` — po sukcesie klient robi pełny refetch (`GET /tasks`), w przeciwieństwie do `onUpdate`, które jest jawnie optimistic. Trzy rozróżnialne stany błędu (422 brak mowy, 200 zero zadań, 502 awaria AI) mapowane na baner UI.

**Technical debt (2-3 najważniejsze, jedno potwierdzone ast-grepem)**: (1) zduplikowany insert do `tasks` w dwóch routerach, **potwierdzone ast-grepem** dokładnie 2 identyczne wystąpienia; (2) zero testów na 5 z 6 plików ścieżki — ale to nie jest nienazwane ryzyko: `context/foundation/test-plan.md:42` już wymienia to jako ryzyko #1, Faza 2, status „not started" — analiza to potwierdza i pogłębia, nie odkrywa od nowa; (3) brak transakcyjności — jeśli insert padnie po udanej (kosztownej) transkrypcji+ekstrakcji, transkrypt i taski są tracone bez logowania.

## 4. Plan refaktoryzacji (z L4)

**Co refaktoryzowane**: z czterech kandydatów w rankingu (duplikacja insertu, duplikacja `TaskStatus`, brak transakcyjności, nietypowany klient Supabase) wybrano **C1 (wydzielić wspólną `insertTasks()`)** + tani prerekwizyt: **włączyć backendowy `typecheck` jako blokujący krok CI** (dziś nie uruchamiany wcale — zweryfikowane bezpośrednio, żaden job CI nie typechecku­je `backend/src`).

**Czego świadomie NIE robimy**: `TaskStatus` (brak mechanizmu współdzielenia między RN a Workerem, wymaga nowej infrastruktury), typowany klient Supabase (zależny od włączonego CI typecheck jako prerekwizytu), logowanie przy błędzie insertu (najsłabszy dowód intencjonalności z czterech, odłożone do `test-plan.md` Fazy 2.

**Fazy planu**: (1) dodać krok `npm run typecheck` do joba `backend-tests` w CI, blokujący od razu — baza zweryfikowana czysta tej sesji, zero ryzyka; weryfikacja: automatyczna (Actions run pokazuje zielony krok). (2) Wydzielić `insertTasks()` do `backend/src/db/tasks.ts`, przepiąć oba routery, rozszerzyć `fake-supabase.ts` o nagrywanie argumentów insertu, dodać test jednostkowy; weryfikacja: automatyczna (`typecheck`+`test`) i ręczna (`wrangler dev`, jedno wywołanie każdego endpointu).

## 5. Domena wg DDD (z L5)

**Ubiquitous language**: PRD i kod są nietypowo spójne — brak klasycznego „3×Account". Kluczowe pojęcia: `Task` (jedna nazwa w całym repo), `TaskStatus` (todo/done/deleted), `Transcript` (nigdy nie persystowany, świadomie). Najciekawszy rozjazd model-vs-kod: FR-007 (opcjonalny ekran przeglądu przed zapisem) nigdy nie zaimplementowany — ale PRD sam oznacza go jako nice-to-have, więc to nie błąd, tylko luka warta jawnego zapisania.

**Niezmiennik #1 i agregat**: „tekst tasku nigdy nie jest pusty" — dziś egzekwowany niezależnie w trzech miejscach (`ai/extract.ts`, `POST /tasks`, `PATCH /tasks/:id`), z których jedno (`routes/transcribe.ts`) w ogóle nie waliduje, tylko ufa sąsiadowi. Projekt agregatu zbiega się z L4: ta sama `insertTasks()`, którą L4 tworzy dla usunięcia duplikacji insertu, staje się naturalnym jedynym miejscem egzekwowania tego niezmiennika.

**Anti-Corruption Layer**: `src/app/reset-password.tsx` woła `supabase.auth.exchangeCodeForSession()` bezpośrednio, z pominięciem portu `lib/auth.tsx`, mimo że **ta sama operacja już istnieje** wewnątrz `signInWithGoogle` — z inną obsługą błędów w każdym miejscu. Kryterium sukcesu (sprawdzalne grepem): `supabase.auth.exchangeCodeForSession` powinno występować w dokładnie jednym pliku (`auth.tsx`), nie dwóch.

## 6. Decyzje, które należą do mnie

Spośród czterech kandydatów refaktoryzacji wybrałem najwęższy, najbezpieczniejszy zakres (C1 + CI typecheck) zamiast całej czwórki naraz — to była moja decyzja przy `AskUserQuestion`, nie domyślny wybór agenta. 
W ramach tego zakresu potwierdziłem trzy dalsze wybory: nowy moduł `backend/src/db/tasks.ts` zamiast dopisywania do istniejącego `supabase.ts`, dodanie nowego testu domykającego lukę bezpieczeństwa zamiast czysto mechanicznej ekstrakcji i blokujący tryb nowego kroku CI — wszystkie trzy zgodne z rekomendacją agenta, ale świadomie zaakceptowane po zobaczeniu uzasadnienia.
