---
date: 2026-09-04T20:05:22+02:00
researcher: Claude (10x-research)
git_commit: 626f4cfc54183097882e380ca9f5478fcde96ed8
branch: fix/claude-review-track-progress
repository: 10xDEVS (Tellme)
topic: 'Voice-to-task pipeline: end-to-end trace, test gaps, blast radius (M4L3 Deep Focus)'
tags: [research, codebase, voice-pipeline, transcribe, extract, tasks, deep-focus]
status: complete
last_updated: 2026-09-04
last_updated_by: Claude (10x-research)
---

# Research: Voice-to-task pipeline — Deep Focus

**Date**: 2026-09-04T20:05:22+02:00
**Researcher**: Claude (10x-research)
**Git Commit**: 626f4cfc54183097882e380ca9f5478fcde96ed8
**Branch**: fix/claude-review-track-progress
**Repository**: 10xDEVS (Tellme)

## Research Question

Deep Focus na przepływ głos→zadanie (`record-button.tsx` → `onRecord` → `lib/api.ts::transcribe` → `POST /transcribe` → Whisper → Claude → Supabase insert → `fetchTasks`/UI), wskazany w `context/map/repo-map.md` jako Strefa ryzyka #1: jedyny obszar appki bez testów po obu stronach, który nigdy nie przeszedł przez pełny cykl `research → plan`. Cel: **Feature overview** (przepływ, nie spis plików) i **Technical debt** (konkretne ryzyka, evidence/inference/unknown), zero refaktoru i zero decyzji na tym etapie.

## Summary

Pipeline działa jako prosty, liniowy łańcuch (nagranie → Whisper → Claude → Supabase insert → GET refetch → render), bez cykli, bez optimistic UI dla samego nagrywania (w przeciwieństwie do `onUpdate`, które _jest_ optimistic). Zewnętrzne SDK (Cloudflare Workers AI, Anthropic) są dobrze izolowane — to nie jest źródło ryzyka. Ryzyko siedzi gdzie indziej: **zero testów** na 5 z 6 plików ścieżki (6. ma tylko przypadkowy test 401, nie sięgający właściwej logiki), **zduplikowany, nietypowany insert** do Supabase w dwóch routerach bez niczego, co złapałoby rozjazd, **zduplikowany `TaskStatus`** między klientem a backendem bez wspólnego źródła, i **brak transakcyjności** przy częściowej awarii (transkrypcja + ekstrakcja się udały, zapis nie — koszt poniesiony, dane utracone). Najważniejsze: `context/foundation/test-plan.md` **już nazywa dokładnie to ryzyko** jako pozycję #1 w rejestrze ryzyk i przypisuje je do Fazy 2, ze statusem „not started" — ta analiza nie odkrywa nowego problemu, potwierdza i pogłębia już zapisany.

## ➡️ Feature overview

Przepływ, nie spis plików — od naciśnięcia przycisku do zadania na liście:

1. **Start nagrywania.** Tap na `RecordButton` (`src/components/record-button.tsx:16`, czysto prezentacyjny) woła `onRecord` w `src/app/(app)/index.tsx:84-113`: prosi o uprawnienia mikrofonu, startuje `useAudioRecorder` (`expo-audio`), `setRecordState('recording')`.
2. **Stop i wysyłka.** Drugi tap wchodzi w gałąź `src/app/(app)/index.tsx:62-81`: `setRecordState('busy')` (przycisk pokazuje spinner i jest zablokowany — `record-button.tsx:16,23-24`), `recorder.stop()`, potem `transcribe(recorder.uri)` z `src/lib/api.ts:49-65`. Ta funkcja buduje `FormData` (osobna gałąź web/native dla kształtu pliku), dokleja nagłówek `Authorization` z aktualnej sesji Supabase (`api.ts:9-14`) i strzela `POST /transcribe`.
3. **Serwer: autoryzacja.** `requireAuth` (`backend/src/middleware/auth.ts:13-22`) wymaga bearer tokena, buduje klienta Supabase noszącego ten token (RLS robi resztę), **nie weryfikuje podpisu JWT lokalnie** — świadoma decyzja udokumentowana w komentarzu (limit 10ms CPU free-tier Workera).
4. **Transkrypcja.** `transcribeAudio` (`backend/src/ai/transcribe.ts:11-21`) koduje audio do base64 i woła binding Cloudflare Workers AI (`whisper-large-v3-turbo`). Surowe audio nigdy nie trafia do żadnego store'a — trzymane tylko w pamięci requestu.
5. **Ekstrakcja zadań.** `extractTasks` (`backend/src/ai/extract.ts:31-52`) woła Claude (`claude-opus-4-8`) z wymuszonym JSON schema (`{ tasks: string[] }`), `effort: 'low'`, żeby zmieścić się w budżecie 10s z PRD. Reguła biznesowa wprost w promptcie: jeden task na jeden wypowiedziany element, bez scalania, bez wymyślania.
6. **Zapis.** Jeśli `texts.length > 0`, insert do Supabase `tasks` przez klienta RLS-scoped (`backend/src/routes/transcribe.ts:48-53`). Odpowiedź: `{ transcript, tasks: data }`, HTTP 201.
7. **Powrót do klienta — kluczowe znalezisko.** Klient **nie** wstawia zwróconych `tasks` bezpośrednio do stanu UI. `onRecord` (`index.tsx:69-75`) liczy tylko `added.length` na banner, po czym woła `load()` → `fetchTasks()` → osobny `GET /tasks` → `setTasks(...)`. Innymi słowy: **lista odświeża się przez pełny refetch, nie przez dane z odpowiedzi `/transcribe`.** To nie jest optimistic UI — w przeciwieństwie do `onUpdate` (`index.tsx:115-130`), które _jest_ jawnie optimistic (komentarz w kodzie to nazywa) i dopiero przy błędzie robi `load()` jako rekoncyliację.
8. **Render.** `FlatList` w `index.tsx:185-202` renderuje `TaskCard` na każdy task ze świeżo pobranej listy.

**Walidacja i stan błędu po drodze:** trzy różne, rozróżnialne stany pustki/błędu po stronie serwera — `422 no speech detected` (pusty transkrypt), `200 { tasks: [] }` (transkrypt był, ale zero zadań — to nie błąd, celowy stan), `502` (Whisper lub Claude rzuciły wyjątek, w tym `stop_reason === 'refusal'` z klasyfikatora bezpieczeństwa Claude). Klient mapuje wszystko poza pustą listą na baner z komunikatem błędu i wraca do `idle`, bez wywołania `load()`.

## 🔧 Technical debt

Rozróżnienie evidence / inference / unknown zachowane z podresearchów.

### 1. Zero testów na 5 z 6 plików ścieżki (evidence)

- `record-button.tsx`, `index.tsx::onRecord`, `api.ts::transcribe`, `ai/transcribe.ts`, `ai/extract.ts` — **żaden test ich nie importuje ani nie wywołuje.**
- `backend/src/routes/transcribe.ts` ma dokładnie jeden przypadkowy test: `auth-gate.test.ts` sprawdza 401 przy braku tokena, dzielony z trzema innymi trasami — nigdy nie dochodzi do właściwej logiki handlera (parsowanie formularza, wywołanie Whisper/Claude, insert).
- Kontrast: CRUD (`tasks.test.ts` 15 przypadków) + auth-gate (5) + IDOR na żywej sieci (2) + recovery (14) = **31 przypadków** pokrywających happy path, walidację, błędy backendu, 404 i granicę autoryzacji cross-user. Backend biegnie w CI (`.github/workflows/ci.yml`, job `backend-tests`); frontendowy Jest **nie biegnie w CI wcale** (`lint-typecheck` robi tylko lint + `tsc --noEmit` + prettier, bez `npm test`).
- **To nie jest nienazwane ryzyko.** `context/foundation/test-plan.md:42` wymienia dokładnie to jako pozycję #1 rejestru ryzyk („Transcription/extraction fails or hangs without a distinct, actionable error state"), Impact: High, Likelihood: High, przypisane do Fazy 2 („AI pipeline error-handling coverage"), **status: not started**. `test-plan.md:92` potwierdza: „API mocking: none yet" — nie ma nawet infrastruktury do mockowania Whisper/Claude.

### 2. Zduplikowany insert bez niczego, co złapie rozjazd (evidence)

- `backend/src/routes/transcribe.ts:48-52` i `backend/src/routes/tasks.ts:53-57` mają identyczny blok `.from('tasks').insert(texts.map(text => ({ text }))).select()`, zbudowany niezależnie w dwóch osobnych, sekwencyjnych commitach (najpierw CRUD, potem pipeline głosowy — insert skopiowany, nie wydzielony).
- **Nic by tego nie złapało:** `createClient()` w `backend/src/supabase.ts` jest wołany bez generyka `Database` — `.insert()` przyjmuje dowolny kształt na etapie kompilacji. Fake Supabase w testach (`backend/test/support/fake-supabase.ts`) jawnie **nie sprawdza argumentów** przekazywanych do `.insert()`/`.eq()` (komentarz w pliku to przyznaje wprost). Backendowy `typecheck` (`backend/package.json` skrypt) **nie jest wołany w CI** — tylko `vitest run`.
- Konsekwencja: nowa wymagana kolumna dodana do jednego insertu, a zapomniana w drugim, przejdzie kompilację, przejdzie wszystkie istniejące testy i przejdzie CI — ujawni się dopiero jako błąd Postgresa w runtime (albo, gdy kolumna jest nullable, wcale się nie ujawni).

### 3. `TaskStatus`/`TASK_STATUSES` zduplikowany bez wspólnego źródła (evidence)

- `src/types.ts:1-2` i `backend/src/types.ts:22-23` — identyczne znak w znak, zero importu, zero codegenu między nimi (potwierdzone: żaden skrypt w żadnym `package.json` tego nie generuje). Pełna analiza domenowa: `context/domain/01-domain-distillation.md`.

### 4. Brak transakcyjności przy częściowej awarii (evidence + inference)

- Jeśli insert w kroku 6 zwróci błąd po tym, jak Whisper i Claude już się wykonały (koszt poniesiony), handler zwraca `500 { error: error.message }` i **odrzuca transkrypt i wyekstrahowane teksty** — brak retry, brak fallbacku, brak cache po stronie klienta pozwalającego ponowić bez powtórnego nagrywania (potwierdzone brakiem takiego kodu — to jest inference: nie zweryfikowano runtime, ale nie znaleziono żadnego mechanizmu, który by temu zaprzeczał).
- Ten sam brak transakcyjności istnieje symetrycznie w `routes/tasks.ts`, więc to spójna, choć krucha, konwencja w całym backendzie — nie odosobniony błąd tej jednej ścieżki.

### 5. Znany, nie domknięty dług UI (evidence)

- `src/components/record-button.tsx:10-11`: `// Reanimated temporarily removed to isolate an iOS-only freeze. The pulse ring is static for now; restore the animation once the root cause is fixed.` — świadomy, udokumentowany, ale wciąż otwarty dług na głównym CTA appki.

### 6. Sekrety środowiskowe rozproszone (evidence, low severity)

- `backend/wrangler.toml` deklaruje tylko binding `AI` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` żyją poza nim (`wrangler secret put` / `.dev.vars`), udokumentowane w `context/deployment/deploy-plan.md` i `.env.example`. `deploy-plan.md:111` odnotowuje już jeden przypadek osieroconego sekretu (`OPENAI_API_KEY` po zmianie dostawcy) — dowód, że higiena sekretów tu jest ręczna i już raz dryfowała. **Unknown**: czy produkcyjny Worker ma dziś komplet trzech sekretów — nie da się zweryfikować z samego repo.

### Co NIE jest długiem (żeby nie przesadzić w drugą stronę)

- **Izolacja SDK jest już dobra.** `@cloudflare/workers-types`/`Ai` i `@anthropic-ai/sdk` są zamknięte wyłącznie w `ai/transcribe.ts` i `ai/extract.ts`; router przekazuje tylko surowy binding i string klucza, nigdy typ vendora. To przykład granicy, która działa — nie kandydat do zmiany.
- **Frontend nie przecieka Supabase SDK na tej ścieżce** — `api.ts` i `index.tsx` nie importują `@supabase/supabase-js` bezpośrednio, tylko przez `lib/supabase.ts`/`lib/auth.tsx`.
- **Niska liczba współzmian `record-button.tsx`↔`api.ts` (2 na 43 commity) nie jest sama w sobie dowodem problemu** — strukturalnie wynika z tego, że `record-button.tsx` jest czystym komponentem prezentacyjnym bez importu sieciowego kodu. To zdrowy podział, nie zaniedbanie samo w sobie (choć w połączeniu z punktami 1-2 czyta się jako „zbudowane raz i nigdy nie odwiedzone ponownie" — patrz inference w blast-radius powyżej).

## Detailed Findings

### Trace end-to-end

Pełna sekwencja krok po kroku z cytatami `plik:linia` i diagramem Mermaid: patrz sekcja **Feature overview** wyżej dla streszczenia; kroki, gałęzie błędów (transcribeAudio throw → 502, pusty transkrypt → 422, zero tasks → 200 pusta lista, refusal klasyfikatora Claude → 502, błąd insertu → 500) i pełny diagram sekwencji zostały zweryfikowane plik po pliku przez dedykowanego subagenta; kluczowe cytaty:

- `src/app/(app)/index.tsx:62-113` (`onRecord`, obie gałęzie)
- `src/lib/api.ts:49-65` (`transcribe()`)
- `backend/src/routes/transcribe.ts:19-56` (cały handler, trzy try/catch)
- `backend/src/ai/transcribe.ts:11-21`, `backend/src/ai/extract.ts:31-52`

### Test gaps

Zob. Technical debt §1. Pełna tabela plik-po-pliku (4 pliki frontendowe, 5 backendowych, kto co pokrywa) i porównanie z `tasks.test.ts`/`idor.test.ts`/`recovery.test.ts` została zebrana przez dedykowanego subagenta; najważniejszy pojedynczy cytat: `test-plan.md:42` już nazywa ten dokładny gap jako ryzyko #1.

### Blast radius

Zob. Technical debt §2-4. Zweryfikowano wprost: brak generyka `Database` na kliencie Supabase (`backend/src/supabase.ts`), brak inspekcji argumentów w fake'u testowym (`backend/test/support/fake-supabase.ts:13-15`), brak `typecheck` w CI dla backendu (`backend/package.json` skrypt zdefiniowany, nigdzie niewołany w `.github/workflows/ci.yml`).

## Code References

- `src/components/record-button.tsx:10-32` — komponent + udokumentowany dług (animacja)
- `src/app/(app)/index.tsx:46-60,62-113,115-130` — `load()`, `onRecord`, `onUpdate` (optimistic vs nie)
- `src/lib/api.ts:9-14,22-31,33-44,49-65` — `authHeader`, `fetchTasks`, `updateTask`, `transcribe`
- `backend/src/routes/transcribe.ts:16,19-56` — auth gate + cały handler
- `backend/src/routes/tasks.ts:53-57` — zduplikowany insert
- `backend/src/ai/transcribe.ts:11-21`, `backend/src/ai/extract.ts:12-52` — porty do Whisper/Claude
- `backend/src/middleware/auth.ts:13-22` — brama auth, świadomie bez weryfikacji podpisu JWT
- `backend/src/supabase.ts:15-32` — klienci Supabase, `LOAD-BEARING` `global: { fetch }`, brak generyka `Database`
- `src/types.ts:1-2` / `backend/src/types.ts:22-23` — zduplikowany `TaskStatus`
- `context/foundation/test-plan.md:42,66-67,92,114,117` — ryzyko #1, faza 2 (not started), brak mockowania AI, gate CI frontend (Faza 5, not started)
- `.github/workflows/ci.yml:10-30,32-67` — co faktycznie biegnie w CI (backend tak, frontend Jest nie)
- `backend/test/support/fake-supabase.ts:13-31` — fake nie inspekcjonuje argumentów insert/update

## Architecture Insights

- Pipeline jest liniowy i bez cykli (potwierdzone też grafem `madge` w `context/map/artifact-2-structure.md`) — złożoność nie jest strukturalna (rozgałęzienia, warstwy), tylko **proceduralna**: trzy sekwencyjne wywołania zewnętrzne (Whisper, Claude, Supabase) bez transakcji obejmującej całość.
- Wzorzec „refetch zamiast optimistic" na ścieżce nagrywania kontrastuje świadomie z `onUpdate`, które jest optimistic. To nie jest niespójność — to different-cost trade-off (nagranie i tak czeka na sieć przez naturę zadania: musi wrócić transkrypt), ale warto go nazwać wprost, bo różnica nie jest widoczna bez czytania obu funkcji obok siebie.
- Backend nie ma warstwy `store`/`repository` — dostęp do Supabase jest wołany bezpośrednio z routerów, co jest wprost powodem, dla którego insert mógł się zduplikować bez wysiłku: nie ma jednego miejsca, które by to wymusiło.

## Historical Context (from prior changes)

- `context/changes/testing-backend-test-foundation/` — skąd wzięła się dzisiejsza asymetria pokrycia (backend CRUD/auth ma testy, bo to była explicit Faza 1; voice pipeline nie, bo to Faza 2, jeszcze nie zaczęta).
- `context/changes/complete-auth-oauth-reset/` — kontrast procesowy: ten obszar przeszedł pełny cykl `research → plan → implement → review`; voice pipeline nigdy nie miał swojego change-id przed tym researchem.
- `context/foundation/test-plan.md` — już zawiera dokładnie zidentyfikowane tu ryzyko (§2, pozycja #1) i plan jego domknięcia (§3, Faza 2), obecnie „not started".

## Related Research

- `context/map/repo-map.md`, `context/map/artifact-1-territory.md`, `context/map/artifact-2-structure.md` — Wide Scan, z którego wzięto punkt wejścia do tego Deep Focus.

## Weryfikacja twierdzeń strukturalnych (ast-grep)

Narzędzie: `npx --package=@ast-grep/cli ast-grep` (efemeryczne, nic nie dopisane do `package.json`). Każde zero potwierdzone klasycznym `grep`, zgodnie z regułą z lekcji.

| Twierdzenie                                                                        | Wzorzec                                                                                                    | Wynik                                                                                                                                                                                                            | Werdykt                                                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Insert do `tasks` zduplikowany w dokładnie 2 miejscach, identyczny kształt         | `supabase.from('tasks').insert($$$)`                                                                       | `routes/transcribe.ts:49-51`, `routes/tasks.ts:54-56` — dokładnie 2 trafienia, identyczne                                                                                                                        | **potwierdzone**                                                                                                                   |
| `TASK_STATUSES` zdefiniowany niezależnie w 2 plikach, identyczna tablica           | `export const TASK_STATUSES = $$$`                                                                         | `src/types.ts:1`, `backend/src/types.ts:22` — dokładnie 2, identyczne `['todo', 'done', 'deleted']`                                                                                                              | **potwierdzone**                                                                                                                   |
| `@anthropic-ai/sdk` izolowany do jednego pliku                                     | `import $$$ from '@anthropic-ai/sdk'`                                                                      | tylko `backend/src/ai/extract.ts:1`                                                                                                                                                                              | **potwierdzone**                                                                                                                   |
| `@cloudflare/workers-types` (`Ai`) nie przecieka do routera                        | `import $$$ from '@cloudflare/workers-types'`                                                              | `backend/src/types.ts:1` (deklaracja `Env.AI`) i `backend/src/ai/transcribe.ts:1` — `routes/transcribe.ts` nie importuje go bezpośrednio                                                                         | **potwierdzone**                                                                                                                   |
| `@supabase/supabase-js` w `src/` ograniczony do `lib/supabase.ts` i `lib/auth.tsx` | `import $$$ from '@supabase/supabase-js'` (osobno `.ts`/`.tsx`, bo ast-grep nie przyjmuje list językowych) | dokładnie po jednym trafieniu w każdym z tych dwóch plików, zero gdzie indziej w `src/`                                                                                                                          | **potwierdzone**                                                                                                                   |
| Zero testów referencuje `transcribeAudio`/`extractTasks`                           | `grep -rln "transcribeAudio\|extractTasks" backend/test/ src/lib/__tests__/`                               | brak wyników                                                                                                                                                                                                     | **potwierdzone** (grep, nie ast-grep — funkcje wywoływane, nie importowane po nazwie w sposób, który wart był osobnego wzorca AST) |
| Cross-check: czy insert-duplikacja pomija jakieś inne wystąpienie `.from('tasks')` | `grep -rn "from('tasks')" backend/src/ src/`                                                               | 5 wystąpień łącznie: 2 insert (już policzone), 1 `select().limit(1)` w `index.ts:29` (db-check), 1 `select('*')` w `tasks.ts:30`, 1 `update()` w `tasks.ts:84` — różne operacje, poprawnie odróżnione od insertu | **potwierdzone, bez korekt**                                                                                                       |

Żadne twierdzenie strukturalne w tym raporcie nie zostało obalone ani doprecyzowane — wszystkie liczby i „tylko tutaj" z sekcji Feature overview/Technical debt zgadzają się z wynikiem AST.

## Open Questions

- Czy produkcyjny Worker ma dziś komplet trzech sekretów (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`) poprawnie ustawionych — nie da się zweryfikować z samego repo (unknown, patrz Technical debt §6).
- Wizualne zachowanie UI między `recorder.stop()` a rozwiązaniem `load()` (czy jest zauważalna pauza bez żadnego stanu pośredniego) — wywnioskowane z braku kodu pośredniego `setTasks`, nie zweryfikowane przez uruchomienie appki.
- Czy inne, niepowiązane z tą ścieżką pliki mają podobnie niską liczbę współzmian (co sugerowałoby ogólnie niski churn projektu, nie coś specyficznego dla tej ścieżki) — poza zakresem tego researchu.
