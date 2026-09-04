---
change_id: voice-task-pipeline
title: Deep Focus research on the voice-to-task pipeline
status: preparing
created: 2026-09-04
updated: 2026-09-04
archived_at: null
---

## Notes

Deep Focus: analiza przepływu danych głos→zadanie (record-button.tsx → backend/src/routes/transcribe.ts → ai/transcribe.ts → ai/extract.ts → routes/tasks.ts). To rdzeń produktu Tellme, wskazany w context/map/repo-map.md jako strefa ryzyka #1 — jedyny obszar appki bez żadnych testów po obu stronach, który nigdy nie przeszedł przez pełny cykl research→plan (w przeciwieństwie do auth). Ta zmiana jest tylko researchem: żadnego refaktoru, żadnej decyzji na tym etapie — produktem jest research.md z sekcjami Feature overview i Technical debt.
