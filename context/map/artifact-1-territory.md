---
title: 'Wide Scan — Territory'
type: map-artifact
created: 2026-09-04
---

# Artifact 1 — Terytorium (historia gita)

**Scope note:** 43 commitów, 2026-06-10 → dziś (~3 miesiące), jeden autor pod dwiema tożsamościami gita (`Konrad Matulewicz` / `Konrad.M` — ta sama osoba). Za mało historii i za mało ludzi na kwartalny trend albo realną mapę kontrybutorów — patrz `artifact-3-contributors.md` dla wprost nazwanego ograniczenia. To, co historia i tak dobrze pokazuje na tej skali: gdzie skupiła się praca i co zmienia się razem.

## Top zmieniane pliki (cała historia, bez szumu)

Odfiltrowane: `package-lock.json`, `.wrangler/`, `dist/`, `Prework/` (materiały kursowe, nie kod appki), `.claude/skills/`, `.claude/prompts/` (toolkit, nie domena).

| #   | Plik                                                         | Zmiany | Komentarz                                         |
| --- | ------------------------------------------------------------ | ------ | ------------------------------------------------- |
| 1   | `CLAUDE.md`                                                  | 8      | root instrukcji — rośnie z każdą fazą projektu    |
| 2   | `package.json`                                               | 7      | zależności frontendu                              |
| 3   | `.github/workflows/claude-review.yml`                        | 6      | CI/AI review, dostrajane                          |
| 4   | `src/components/animated-icon.tsx`                           | 5      | **usunięty** — martwy scaffold Expo (patrz niżej) |
| 5   | `backend/src/index.ts`                                       | 5      | entry point Workera                               |
| 6   | `backend/package.json`                                       | 5      | zależności backendu                               |
| 7   | `app.json`                                                   | 5      | konfiguracja Expo                                 |
| 8   | `src/lib/auth.tsx`                                           | 4      | provider auth (frontend)                          |
| 9   | `src/components/ui/collapsible.tsx`                          | 4      | **usunięty** — scaffold                           |
| 10  | `src/app/_layout.tsx`                                        | 4      | root layout / auth gate                           |
| 11  | `context/changes/complete-auth-oauth-reset/{plan,change}.md` | 4+4    | jedyna duża, imienna zmiana w historii            |

**Znalezisko: struktura kłamie (częściowo).** Cztery z top-15 najczęściej zmienianych plików (`animated-icon.tsx`, `ui/collapsible.tsx`, `app-tabs.tsx`, `app-tabs.web.tsx`) **już nie istnieją** — to martwy scaffold z `create-expo-app`, który był edytowany kilka razy, a potem w całości usunięty. Podobnie `src/app/index.tsx` (stary, płaski routing) zniknął — trasy przeniosły się pod grupę `(app)/`. Historia „top zmienianych" bez weryfikacji obecności w repo myliłaby; wszystkie liczby powyżej są już przefiltrowane pod kątem tego, co realnie istnieje dziś (poza jawnie oznaczonymi „usunięty").

## Katalogi z największą aktywnością (kod appki, bez `Prework/`, `.claude/`, `context/`)

| Katalog                          | Zmiany | Rola                                                                                              |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `src/components`                 | 26     | UI — w dużej mierze martwy scaffold + żywe komponenty (`record-button`, `task-card`, `segmented`) |
| `src/app`                        | 18     | ekrany (Expo Router)                                                                              |
| `src/lib`                        | 13     | logika domenowa klienta: auth, api, recovery                                                      |
| `backend/test`                   | 13     | testy Workera                                                                                     |
| `backend` (root) / `backend/src` | 11 / 9 | Worker: routing, AI, Supabase                                                                     |

## Współzmiany (pary plików w tych samych commitach)

| Para                                                                                            | Wystąpienia | Odczyt                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/index.ts` ↔ `context/deployment/deploy-plan.md`                                    | 4           | deploy Workera i jego plan idą razem — spójne                                                                                            |
| `backend/package.json` ↔ `backend/src/index.ts`                                                 | 4           | zależności i entry point backendu — spodziewane                                                                                          |
| `app.json` ↔ `package.json`                                                                     | 4           | konfiguracja Expo i zależności — spodziewane                                                                                             |
| `src/lib/auth.tsx` ↔ `src/lib/supabase.ts`                                                      | 3           | auth i klient Supabase — spójna para, brak zaskoczenia                                                                                   |
| `context/changes/complete-auth-oauth-reset/change.md` ↔ `src/lib/auth.tsx`                      | 3           | change-id i implementacja auth idą razem — proces działa jak powinien                                                                    |
| `src/app/sign-in.tsx` ↔ `src/lib/{auth.tsx,recovery.ts,supabase.ts}` + testy `recovery.test.ts` | 2 każda     | ekran logowania konsekwentnie zmienia się z warstwą auth — spójny klaster                                                                |
| `src/components/record-button.tsx` ↔ `src/lib/api.ts`                                           | 2           | **jedyna** współzmiana dotykająca ścieżki nagrywanie→transkrypcja; niska liczba, bo ta ścieżka w ogóle rzadko była ruszana po zbudowaniu |

Brak niepokojących współzmian „na odległość" (np. backend i frontend zmieniające ten sam koncept bez wspólnego pliku) — ale patrz `artifact-2-structure.md` i `03-anti-corruption-layer.md` w `context/domain/`: `TaskStatus`/`TASK_STATUSES` jest zduplikowany **znak w znak** w `src/types.ts` i `backend/src/types.ts` bez importu między nimi, więc git nie złapie rozjazdu, gdyby ktoś zmienił jedną kopię i zapomniał drugiej — to jest dokładnie ten rodzaj sprzężenia, którego współzmiany _nie widzą_, bo nic ich fizycznie nie łączy.

## Plik-hub (dotyka się z najwięcej innych plików)

`package.json`, `CLAUDE.md`, `app.json` dominują — to nie jest ryzyko strukturalne, to normalna konfiguracja repo. Bardziej sygnalny hub: `src/lib/auth.tsx` (46 różnych partnerów współzmian) i `backend/src/index.ts` (32) — obie strony granicy auth/routing są punktami, przez które przewinęła się większość pracy projektu.

## Motywy commitów (namiastka mapy kontrybutorów — patrz artifact-3)

| Typ                                     | Liczba     | Co to mówi                                         |
| --------------------------------------- | ---------- | -------------------------------------------------- |
| `fix(ci)`                               | 5          | najwięcej pojedynczych poprawek poszło w CI        |
| `feat(complete-auth-oauth-reset)`       | 3          | jedyna duża feature z własnym change-id w historii |
| `feat(testing-backend-test-foundation)` | 2          | budowa fundamentu testowego backendu               |
| `chore`, `docs*`                        | ~8 łącznie | porządki i dokumentacja                            |

**Wniosek terytorialny:** projekt ma jedno wyraźne centrum praktycznej pracy — **auth** (sign-in, OAuth Google, reset hasła) — udokumentowane własnym change-id i widoczne jako hub współzmian. Poza tym jest jedna duża, cicha strefa: **pipeline głos→zadanie** (`record-button.tsx` → `backend/src/routes/transcribe.ts` → `ai/transcribe.ts` → `ai/extract.ts` → `routes/tasks.ts`), czyli faktyczna propozycja wartości appki, która od czasu zbudowania niemal nie była dotykana (2 współzmiany łącznie) — cicha nie znaczy bezpieczna, patrz `artifact-3-structure.md`/`repo-map.md` (Strefy ryzyka) dla testów, których tam brakuje.
