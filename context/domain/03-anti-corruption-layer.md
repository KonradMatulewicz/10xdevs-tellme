---
title: 'Anti-Corruption Layer refactor plan — Supabase Auth port'
created: 2026-09-04
type: refactor-plan
---

# Anti-Corruption Layer — port auth (`lib/auth.tsx`) omijany bezpośrednio

**Produkt tego dokumentu to PLAN, nie implementacja.** Żaden kod nie został zmieniony.

## Krok 1 — Identyfikacja przeciekających zależności

Repo ma jeden port domenowy dla auth: `src/lib/auth.tsx` (`AuthProvider`/`useAuth()`), który opakowuje `@supabase/supabase-js`'s `supabase.auth.*`. Sprawdzono wszystkie miejsca, które „znają" ten pakiet lub jego wrappowany singleton:

- `grep -rn "supabase\.auth\." src/` → 9 wywołań w `src/lib/auth.tsx` (`onAuthStateChange`, `signInWithPassword`, `signUp`, `signOut`, `signInWithOAuth`, `exchangeCodeForSession`, `resetPasswordForEmail`, `updateUser`) + 1 w `src/lib/api.ts:10` (`getSession`, do pobrania tokena na nagłówek `Authorization`).
- `grep -rn "from '@/lib/supabase'" src/` → trzy pliki: `src/lib/api.ts`, `src/lib/auth.tsx` (oczekiwane — to sam port i jego sąsiad infrastrukturalny), **i `src/app/reset-password.tsx`** — plik UI, ekran.

**Najgorszy przeciek**: `src/app/reset-password.tsx:25,62-63` importuje `supabase` bezpośrednio i woła `supabase.auth.exchangeCodeForSession(code)` **z pominięciem `lib/auth.tsx` całkowicie**, mimo że `lib/auth.tsx:100` **już wywołuje dokładnie tę samą metodę** (`supabase.auth.exchangeCodeForSession(code)`) wewnątrz `signInWithGoogle`. Ta sama operacja SDK ma dziś dwie niezależne implementacje w repo.

Drugi, słabszy przeciek: `AuthState.session: Session | null` w `src/lib/auth.tsx:13` eksponuje typ wprost z `@supabase/supabase-js` jako część publicznego kontraktu portu, zamiast własnego typu domenowego.

## Krok 2 — Klasyfikacja i wybór najgorszego przecieku

| Przeciek                                                                                 | (a) Liczba dotkniętych plików                                                                                                                                             | (b) Koszt wymiany dziś                                                                                                                                             | (c) Czy dokument deklaruje wymienialność?                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exchangeCodeForSession` wołany bezpośrednio w `reset-password.tsx`, z pominięciem portu | 2 (`auth.tsx`, `reset-password.tsx`)                                                                                                                                      | Wymiana Supabase Auth na inny provider wymagałaby znalezienia i poprawienia **dwóch** niezależnych implementacji tej samej operacji, z ryzykiem przeoczenia jednej | Nie explicite, ale `auth.tsx` istnieje właśnie po to, żeby być jedynym miejscem, które „zna" Supabase Auth — cel pliku jest ewidentny z jego własnej struktury (`AuthState` interfejs, `useAuth()` hook) |
| `Session` typu wendora w `AuthState.session`                                             | 1 plik definiuje, 2 pliki konsumują (`(app)/_layout.tsx`, `sign-in.tsx`) — ale **żaden konsument nie sięga po pola specyficzne dla Supabase**, tylko sprawdza `!!session` | Niski — potwierdzone grepem, że jedyne użycia poza `auth.tsx` to `truthy`-check                                                                                    | Nie                                                                                                                                                                                                      |

**Wybór: `exchangeCodeForSession` w `reset-password.tsx`.** To nie jest hipotetyczne ryzyko wymiany dostawcy w przyszłości (jak w klasycznym przykładzie ACL) — to **już dziś istniejąca duplikacja z realnym, obecnym kosztem**: dwie implementacje tej samej operacji mają dwie różne strategie obsługi błędów (patrz Krok 3). `Session`-w-typie jest realny, ale niskiego ryzyka przy obecnym, wąskim sposobie konsumpcji — odnotowany, nie eskalowany do #1.

## Krok 3 — Diagnoza

**`src/lib/auth.tsx:77-107` (`signInWithGoogle`)** — wywołanie `exchangeCodeForSession` na linii 100, błąd mapowany przez `mapAuthError()` (`auth.tsx:27-40` — dedykowana funkcja, przetestowana w `src/lib/__tests__/map-auth-error.test.ts`, 4 przypadki), w tym specjalna obsługa „email already exists" z przyjazną wiadomością.

**`src/app/reset-password.tsx:55-81`** — ten sam wywołanie SDK, ale:

```
supabase.auth
  .exchangeCodeForSession(code)
  .then(({ error: exchangeErr }) => {
    if (exchangeErr) {
      setExchangeStatus('error');
      setExchangeError('This reset link could not be verified. It may have expired or been opened on a different device...');
    }
```

Błąd tutaj **nie przechodzi przez `mapAuthError`** — to osobny, ręcznie napisany komunikat, niespójny stylistycznie i informacyjnie z tym, co `signInWithGoogle` zwróciłby dla analogicznego błędu wymiany kodu. Gdyby `mapAuthError` zyskał w przyszłości nową specjalizację dla błędów wymiany kodu (np. rozróżnienie „kod wygasł" vs „kod już użyty"), `reset-password.tsx` by jej nie dostał — trzeba by pamiętać o dwóch miejscach.

To nie jest hipotetyczne: `reset-password.tsx` i `signInWithGoogle` **oba** implementują wymianę kodu OAuth-stylu (PKCE `flowType`, `src/lib/supabase.ts:26`) dla dwóch różnych przepływów (Google sign-in, reset hasła) — ten sam mechanizm SDK, dwa niezależne wdrożenia w kodzie.

## Krok 4 — Projekt ACL

**Domenowa funkcja** (rozszerzenie istniejącego portu `auth.tsx`, nie nowy plik): dodać `exchangeAuthCode(code: string): Promise<Result>` do `AuthState`, opakowującą `supabase.auth.exchangeCodeForSession` + `mapAuthError`, analogicznie do istniejących `resetPassword`/`updatePassword`.

- **Sygnatura**: `exchangeAuthCode: (code: string) => Promise<Result>` (ten sam kształt `Result` co `signIn`/`resetPassword` — `{ error?: string }`, już zdefiniowany w `auth.tsx:9`).
- **`signInWithGoogle`** (`auth.tsx:77-107`) i **`reset-password.tsx`** oba wołają `exchangeAuthCode(code)` z `useAuth()` zamiast każdy osobno wołać `supabase.auth.exchangeCodeForSession`.
- **Reszta kodu zna tylko `useAuth()`** — `reset-password.tsx` przestaje importować `@/lib/supabase` w ogóle (jego jedyny import stamtąd dziś to właśnie to jedno wywołanie).

## Krok 5 — Dowód izolacji + before/after

**Before:** `grep -rn "supabase\.auth\.exchangeCodeForSession" src/` → 2 pliki (`auth.tsx`, `reset-password.tsx`).
**After (kryterium sukcesu, sprawdzalne w sekundę):** ten sam grep → dokładnie 1 plik (`auth.tsx`). `grep -rn "from '@/lib/supabase'" src/` → 2 pliki (`api.ts`, `auth.tsx`), nie 3.

**Before/after błędu:** dziś użytkownik resetujący hasło z wygasłym linkiem dostaje inny styl komunikatu niż użytkownik, u którego nie powiodła się wymiana kodu Google OAuth — mimo że to technicznie ten sam rodzaj awarii SDK. Po zmianie oba przechodzą przez `mapAuthError`, więc przyszłe usprawnienie komunikatu trafia do obu przepływów naraz, jednym miejscem zmiany.

## Krok 6 — Weryfikacja i plan

**Kryterium sukcesu:** `grep -rn "supabase\.auth\.exchangeCodeForSession" src/` zwraca wyłącznie `src/lib/auth.tsx`.

**Plan faz (do realizacji jako osobna zmiana):**

1. Dodać `exchangeAuthCode` do `AuthState` + `AuthProvider`, wewnętrznie identyczna logika co dzisiejszy fragment `signInWithGoogle:98-101`, żeby `signInWithGoogle` mogła się na niej oprzeć bez zmiany zachowania.
2. Przepiąć `signInWithGoogle` na `exchangeAuthCode` (powinno być zachowaniowo no-op — ten sam kod, przeniesiony).
3. Przepiąć `reset-password.tsx` na `exchangeAuthCode` z `useAuth()`, usunąć import `@/lib/supabase`. **To jest jedyny krok z realną zmianą zachowania** — komunikat błędu zmienia się z ręcznego tekstu na wynik `mapAuthError` (do zdecydowania w planie: czy zachować dzisiejszy tekst jako fallback w `mapAuthError`, czy zaakceptować nowy, spójniejszy komunikat).
4. `src/lib/__tests__/map-auth-error.test.ts` już istnieje i już testuje `mapAuthError` — nowy test dla `exchangeAuthCode` powinien objąć głównie „error przechodzi przez", nie retestować `mapAuthError` samo w sobie.

## Ograniczenia

- Przeciek `Session`-jako-typu-wendora nie jest tu naprawiany — niski koszt dziś (potwierdzone grepem konsumpcji), zostawiony jako odnotowana, świadoma obserwacja w `01-domain-distillation.md`, nie osobny plan.
- Nie zweryfikowano ast-grepem w tym dokumencie (plan, nie zamknięty research) — kryterium sukcesu z Kroku 6 jest jednak trywialnie sprawdzalne samodzielnie po implementacji, tym samym grepem użytym do diagnozy.
