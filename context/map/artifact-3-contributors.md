---
title: 'Wide Scan — Contributors'
type: map-artifact
created: 2026-09-04
---

# Artifact 3 — Kontekst kontrybutorów

**Ta składowa jest w tym repo w dużej mierze zdegenerowana i mówię to wprost, zamiast udawać głębię, której nie ma.** Lekcja M4L2 projektuje tę analizę pod repo z wieloma kontrybutorami (Mattermost: dziesiątki osób) — cel to znaleźć „kogo zapytać". Tellme ma jednego autora pod dwiema tożsamościami gita (`Konrad Matulewicz`, `Konrad.M` — ta sama osoba, różna konfiguracja gita między maszynami/sesjami). Nie ma nikogo do zapytania poza tobą. Sekcja „Kogo zapytać" w `repo-map.md` będzie więc krótka i inna niż w przykładzie z lekcji — zamiast osób, wskaże **które change-idy / dokumenty** niosą kontekst dla danego obszaru.

## To, co historia mimo wszystko pokazuje: klastry tematyczne w czasie

Z motywów commitów (`artifact-1-territory.md`) i dat:

| Okres (przybliżony)   | Temat                                                                   | Dowód                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start (2026-06-10)    | bootstrap Expo + toolkit 10x                                            | commity `chore`, `feat(expo)`                                                                                                                                                       |
| Środek                | fundament testowy backendu                                              | `feat(testing-backend-test-foundation)` ×2, `docs(testing-backend-test-foundation)`, `context/changes/testing-backend-test-foundation/`                                             |
| Środek–koniec         | auth: sign-in, OAuth Google, reset hasła                                | `feat(complete-auth-oauth-reset)` ×3, `fix(complete-auth-oauth-reset)`, `docs(complete-auth-oauth-reset)`, `context/changes/complete-auth-oauth-reset/` (4 pliki, w tym `reviews/`) |
| Ciągłe                | CI                                                                      | `fix(ci)` ×5 — najliczniejsza pojedyncza kategoria w całej historii                                                                                                                 |
| Brak wyraźnego okresu | pipeline głos→zadanie (`record-button`, `routes/transcribe.ts`, `ai/*`) | brak dedykowanego change-id w historii — zbudowany, ale nigdy nie przeszedł przez ten sam proces `research → plan → implement` co auth                                              |

## Co to naprawdę mówi (interpretacja, nie tylko fakt)

Auth przeszło pełny, udokumentowany cykl zmiany (change-id, plan, review). Pipeline głos→zadanie — czyli **rdzeń produktu** — najwyraźniej nie: nie ma dla niego własnego `context/changes/*`, mimo że to on jest właściwym powodem istnienia appki („Speak it. We'll list it." — hasło z ekranu głównego). To jest dokładnie ten rodzaj obserwacji, którego szuka ta składowa: nie „kto", ale „który obszar nigdy nie dostał tej samej uwagi procesowej co reszta" — i to on trafia do L3 (Deep Focus) w tej ścieżce właśnie z tego powodu.

## Ograniczenie do zapisania wprost

Brak ADR-ów i brak wielu autorów oznacza, że w L4 (refaktoryzacja) „historia jako test intencji" nie będzie mogła się oprzeć na `git blame` prowadzącym do innej osoby do zapytania — oprze się wyłącznie na treści commitów i na komentarzach w kodzie. Ten drugi kanał jest w tym repo niezwykle dobry: pliki jak `backend/src/supabase.ts` czy `src/components/record-button.tsx` mają inline'owe uzasadnienia decyzji („LOAD-BEARING", „Reanimated temporarily removed to isolate an iOS-only freeze") które w typowym legacy trzeba by rekonstruować z archeologii gita — tutaj są już zapisane. To zmniejsza, ale nie zeruje, potrzebę `git log -L`/blame w L4.
