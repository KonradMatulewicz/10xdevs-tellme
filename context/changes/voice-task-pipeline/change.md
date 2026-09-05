---
change_id: voice-task-pipeline
title: Deep Focus research on the voice-to-task pipeline
status: preparing
created: 2026-09-04
updated: 2026-09-04
archived_at: null
---

## Notes

Deep Focus: trace the data flow of the voice-to-task pipeline (record-button.tsx → backend/src/routes/transcribe.ts → ai/transcribe.ts → ai/extract.ts → routes/tasks.ts). This is Tellme's product core, flagged in context/map/repo-map.md as risk zone #1 — the only area of the app with zero tests on either side, which has never gone through a full research→plan cycle (unlike auth). This change is research-only: no refactor, no decision at this stage — the deliverable is research.md with Feature overview and Technical debt sections.
