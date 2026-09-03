---
doc: 10xDevs certification requirements
status: reference
source: course announcements (Circle/Baserow), pasted by user
last_updated: 2026-09-03
---

# Wymagania certyfikacyjne 10xDevs 3.0

> Referencyjny zapis wymagań na odznaki 10xDevs, wklejony z ogłoszeń kursu.
> Nie jest to dokument roboczy zmieniany przez skille — edytuj ręcznie, gdy
> organizatorzy zaktualizują zasady. Używany do oceny gotowości projektu
> (np. `.claude/prompts/mvp-check.md` ocenia względem sekcji Builder).

## 10xBuilder (moduły 1–3) — odznaka bazowa, wymagana

Minimalne wymagania techniczne dla MVP przed wypełnieniem formularza:

1. **Obsługa akcji CRUD** — projekt musi pozwalać na tworzenie, odczytywanie,
   aktualizację i usuwanie elementów (np. dodaj / wylistuj / edytuj / usuń
   zadania na liście to-do).
2. **Logika biznesowa** — co najmniej jedna funkcja realizująca logikę wykraczającą
   poza CRUD (np. automatyczne sugerowanie priorytetów zadań na podstawie nazwy,
   opisu i terminu).
3. **Testy** — co najmniej jeden zestaw testów adresujący konkretne ryzyko
   zdefiniowane w dokumencie test-plan.
4. **Autentykacja** — dostęp do systemu powiązany z użytkownikiem, który loguje
   się i widzi tylko przypisane do niego zasoby.

Moduły 1–3 wystarczają do zdobycia tej odznaki; moduły 4–5 nie są wymagane.

## 10xArchitect (moduł 4) — ścieżka dla chętnych

Dowód: **raport architektoniczny** (zwięzły two-pager) złożony z czterech
artefaktów z lekcji modułu 4:

- mapa repozytorium (L2)
- research wybranego ficzera (L3)
- plan refaktoryzacji (L4)
- notatki o domenie inspirowane DDD, `context/domain/` (L5)

Raport generuje się promptem z lekcji M4L5. Kluczowe: raport musi być "mój" —
taki, który da się obronić, nie zaakceptowany bez czytania wynik jednego promptu.

## 10xChampion (moduł 5) — ścieżka dla chętnych

Wystarczy zbudować **jeden z dwóch** projektów modułu 5. Nie wymaga publikowania
firmowego repozytorium — dowodem są zrzuty ekranu pokazujące działanie w danym
kontekście (lub samodzielne PoC).

**Opcja A — Pipeline CI/CD do review kodu (M5L2–L3):**

- widok pipeline'u z co najmniej jednym widocznym jobem
- logi z pipeline'u/joba podczas wykonywania operacji code review
- działanie na PR: zrzut z komentarzem code review od agenta

**Opcja B — Rejestr artefaktów zespołowych (M5L4):**

- repozytorium/rejestr, w którym przepływ istnieje (screenshot)
- definicja paczki lub równoważna definicja artefaktu (np. `package.json`)
- lista wydanych wersji (z UI rejestru lub przez komendę CLI)

## Terminy (wspólne dla całej certyfikacji, zgłoszenia do 23:59)

| #   | Termin     | Uwaga                                              |
| --- | ---------- | -------------------------------------------------- |
| 1   | 2026-07-05 | Jedyny termin z wyróżnieniami i szansą na Demo Day |
| 2   | 2026-08-10 |                                                    |
| 3   | 2026-09-14 | Ostateczny                                         |

## Zasady zgłoszeń

- **Wszystko w jednej turze** — jeśli chcesz więcej niż jedną odznakę
  (np. Builder + Architect + Champion), wszystkie formularze idą w tym
  samym terminie.
- **Tylko jedno podejście** — certyfikacja w jednym, wybranym terminie.
  Warto zgłaszać się bliżej końca wybranego terminu.
- **Brak dorzucania zadań** — zgłoszenie samego Builder w danym terminie
  daje tylko tę odznakę; nie da się później dopisać Architect/Champion
  w kolejnym terminie.

Formularz zgłoszeniowy (jeden dla wszystkich odznak, pola dynamiczne wg wyboru):
https://baserow.io/form/fwnBioduXc90QTli6lsCVL_YgRdTECPTCmwiVhu8d-E
