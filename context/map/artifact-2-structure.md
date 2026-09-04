---
title: 'Wide Scan — Structure'
type: map-artifact
created: 2026-09-04
---

# Artifact 2 — Struktura (graf zależności)

**Narzędzie:** `npx madge --ts-config tsconfig.json` osobno dla `src/` (Expo Router, RN) i `backend/src/` (Hono na Cloudflare Workers) — to dwa oddzielne runtime'y bez wspólnego grafu importów, więc analizowane osobno. `dependency-cruiser` pominięty jako zbędny narzut instalacyjny na 24+8 plików; `madge` daje ten sam sygnał (fan-in/out, cykle) bez dopisywania nowej `devDependency` do `package.json`.

**Pułapka po drodze:** pierwszy przebieg `madge` bez `--ts-config` zgłosił niemal wszystkie pliki `src/app/*` i `src/components/*` jako „orphans" (zero powiązań) — bo nie resolwował aliasu ścieżek `@/*` → `src/*` z `tsconfig.json`. Po dodaniu `--ts-config` graf się zgadza z tym, co faktycznie widać w kodzie. Zostawiam to jako ostrzeżenie: surowy wynik CLI bez sprawdzenia konfiguracji projektu potrafi dać fałszywy obraz „nic nie jest powiązane".

## `src/` — lokalne centra (fan-in, ile plików importuje dany plik)

| Plik                         | Fan-in | Rola                                                                        |
| ---------------------------- | ------ | --------------------------------------------------------------------------- |
| `constants/theme.ts`         | 11     | design tokens — prawdziwy fundament, dotyka go prawie każdy ekran/komponent |
| `hooks/use-theme.ts`         | 9      | pochodna theme.ts, tak samo szeroko używana                                 |
| `components/themed-text.tsx` | 7      | prymityw UI                                                                 |
| `components/themed-view.tsx` | 6      | prymityw UI                                                                 |
| `lib/auth.tsx`               | 6      | jedyny punkt dostępu do sesji/auth w całej appce                            |
| `types.ts`                   | 3      | `Task`/`TaskStatus` — kontrakt między ekranami                              |
| `lib/supabase.ts`            | 3      | klient Supabase                                                             |

Zero cykli (`madge --circular` czysty wynik dla obu grafów).

## `src/` — najgrubsze wejścia (fan-out, ile plik importuje)

| Plik                      | Fan-out | Odczyt                                                                                                                                      |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(app)/index.tsx`     | 10      | ekran główny — nagrywanie, lista zadań, wyszukiwanie, taby w jednym pliku (~250 linii); to jest realne centrum lokalne, nie cienkie wejście |
| `app/reset-password.tsx`  | 7       | formularz + walidacja + integracja recovery                                                                                                 |
| `app/forgot-password.tsx` | 5       | jw.                                                                                                                                         |
| `app/sign-in.tsx`         | 5       | logowanie + Google OAuth + błędy                                                                                                            |

**Orphans (zero in, zero out po alias-fixie):** `app/auth-callback.tsx` (potwierdzone w kodzie — to świadomie cienki `<Redirect href="/" />`, wymiana kodu OAuth dzieje się gdzie indziej, w `lib/auth.tsx::signInWithGoogle`; komentarz w pliku to potwierdza) i `hooks/use-color-scheme.web.ts` (platform-variant, ładowany przez konwencję Expo `.web.ts`, nie przez import — `madge` go z tego powodu nie widzi, to fałszywy orphan, nie martwy kod).

## `backend/src/` — centra i wejścia

| Plik                                | Fan-in  | Fan-out | Rola                                                                    |
| ----------------------------------- | ------- | ------- | ----------------------------------------------------------------------- |
| `types.ts`                          | 5       | 0       | kontrakt: `Env`, `AppEnv`, `TaskStatus` — importowany wszędzie          |
| `middleware/auth.ts`                | 2       | 2       | jedyna bramka auth dla obu routerów                                     |
| `supabase.ts`                       | 2       | 1       | fabryka klientów (anon / per-token)                                     |
| `routes/transcribe.ts`              | 1       | 4       | najgrubszy plik backendu — orkiestruje transkrypcję, ekstrakcję i zapis |
| `routes/tasks.ts`                   | 1       | 2       | CRUD                                                                    |
| `ai/transcribe.ts`, `ai/extract.ts` | 1 każdy | 0       | liście — dobrze izolowane, wywoływane tylko z `routes/transcribe.ts`    |
| `index.ts`                          | 0       | 4       | wire-up Hono                                                            |

Zero cykli.

## Kontrakty i granice, które nie wynikają z samego grafu

- **`TASK_STATUSES`/`TaskStatus` zduplikowane znak w znak** w `src/types.ts` i `backend/src/types.ts` — brak wspólnego pakietu, więc żaden import ani `madge` tego nie złapie. To jest connascence znaczenia na dystansie (patrz `context/domain/01-domain-distillation.md` dla pełnej analizy) — graf zależności z definicji tego nie widzi, bo obie strony nie mają żadnej krawędzi między sobą.
- **SDK-typy przeciekają do warstwy domenowej po stronie klienta**: `src/lib/auth.tsx` importuje `Session` bezpośrednio z `@supabase/supabase-js` i wystawia go jako `AuthState.session` — cały resztę appki, która chce znać stan sesji, zna kształt Supabase, nie własny typ domenowy. Kandydat ACL, patrz `context/domain/03-anti-corruption-layer.md`.
- **Duplikacja logiki zapisu, nie tylko typu**: `backend/src/routes/transcribe.ts` (linie 49–52) i `backend/src/routes/tasks.ts` (linie 54–57) zawierają niemal identyczny blok `supabase.from('tasks').insert(texts.map(...)).select()`. `madge` tego nie pokaże (to nie jest import), ale to prawdziwe sprzężenie: zmiana kształtu insertu wymaga poprawki w dwóch miejscach, a nic tego nie pilnuje.
- **`ai/transcribe.ts` i `ai/extract.ts` to już dobrze skonstruowany port**: obie SDK-zależności (`@cloudflare/workers-types` → `Ai`, `@anthropic-ai/sdk`) są zamknięte w dwóch małych, bezstanowych funkcjach, wołanych wyłącznie z `routes/transcribe.ts`. To nie jest kandydat na refaktor — to przykład granicy, która już działa dobrze i warto ją tak zostawić.

## Ograniczenia tej składowej

- Graf pokazuje importy statyczne w danym momencie, nie intencję ani runtime coupling (np. Cloudflare Workers AI binding `c.env.AI` czy zmienne środowiskowe nie są „importami" i nie pojawią się na grafie).
- `backend/` nie ma warstwy `store`/`repository` do analizy jak w przykładzie z Mattermost — dostęp do Supabase jest wołany bezpośrednio z routerów. To jest samo w sobie obserwacja do `repo-map.md` (Realne powiązania), nie coś, co graf „odkrywa" — trzeba to przeczytać w kodzie.
