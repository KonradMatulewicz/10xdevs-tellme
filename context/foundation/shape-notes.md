---
project: Tellme
context_type: greenfield
product_type: mobile
target_scale:
  users: small
updated: 2026-06-09
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6]
  frs_drafted: 14
  timeline_budget:
    mvp_weeks: 2
    after_hours_only: false
    hard_deadline: null
  quality_check_status: accepted
---

## Vision & Problem Statement

**Pain**: Voice memos are fast to record but slow to process — they require re-listening and manual transcription before anything is actionable. This is a workflow friction problem: the capture step works, but the transcription-to-task step is the bottleneck that kills follow-through.

**Person**: The primary user is the product owner themselves — a busy person who regularly uses TODO lists and captures ideas on the go. Target audience extends to freelancers, office workers, and students who share the same pattern.

**Moment**: When an idea, task, or reminder strikes but hands are occupied or typing is inconvenient.

**Cost today**: Either the thought is lost, or it ends up in a voice memo that accumulates with others — creating a secondary backlog that needs manual processing before any task can be acted on.

**Insight**: Adoption resistance hypothesis not yet formed. To revisit post-MVP.

## User & Persona

**Primary persona**: Busy individual (self) who uses TODO lists regularly and encounters ideas/tasks in situations where typing is inconvenient. Uses voice recording as a capture shortcut today, but loses value in the processing gap between recording and having an actionable task list.

**Persona scope**: Single user initially (the product owner); broader individual users across many orgs as the product scales.

## Access Control

**Auth model**: Email + password and Google OAuth (Sign in with Google). Both options available at registration and login. Tasks are tied to the user account and accessible from any device.

**Role model**: Flat. Every authenticated user sees only their own tasks. No admin/member separation in MVP.

## Success Criteria

### Primary
User opens the app, records a voice note, and receives a structured task list within 10 seconds. At least 80% of generated tasks require no manual correction. User can then edit, mark as done, and delete tasks. This flow working end-to-end = the product works.

### Secondary
Inline editing of extracted tasks before saving — user can tweak the AI output immediately after extraction, before it's committed to the list.

### Guardrails
- Voice recording must work on mobile browsers (not just desktop) — the primary use case is on-the-go capture; mobile is the core device.

## Functional Requirements

### Authentication
- FR-001: User can register and log in with email + password or Google OAuth. Priority: must-have
  > Socrates: Counter-argument considered: "registration is overhead if the primary user is yourself." Resolution: kept; both auth paths (email/password + Google OAuth) give users flexibility. Note: email/password requires a password-reset flow to be complete.
- FR-002: User can reset their password via email. Priority: must-have
  > Socrates: No counter-argument; email/password without password reset creates a support dead-end when users forget credentials.
- FR-013: User can log out of their account. Priority: must-have
  > Socrates: Counter-argument considered: "logout is dead code in v1; token expiry handles security." Resolution: kept; basic session control is table stakes.

### Voice Capture
- FR-003: User can record a voice note via the browser (mobile and desktop). Priority: must-have
  > Socrates: Counter-argument considered: "file upload is faster to build and covers the same use case." Resolution: kept; live recording is the core UX — file upload is not a substitute.
- FR-004: App automatically transcribes and processes the recording when the user stops. Priority: must-have
  > Socrates: Counter-argument accepted: "auto-processing on stop removes a redundant manual trigger tap." Updated: no separate trigger step — stop = process immediately.

### AI Pipeline
- FR-005: App transcribes recorded audio to text. Priority: must-have
  > Socrates: Counter-argument considered: "transcription quality degrades for accented speech and background noise." Resolution: kept; quality floor (80%) is a success criterion, not a guarantee — acknowledged risk.
- FR-006: App extracts individual tasks from the transcribed text. Priority: must-have
  > Socrates: Counter-argument considered: "extraction can fail silently, leaving user with an empty list and no explanation." Resolution: kept; failure feedback is a UX concern (show error state), not a reason to drop the FR.

### Task Review & Save
- FR-007: User can review and inline-edit extracted tasks before they are saved. Priority: nice-to-have
  > Socrates: Counter-argument accepted: "an edit-before-save screen slows the happy path." Resolution: happy path auto-saves (FR-008); FR-007 is an optional non-blocking review step, not a mandatory confirmation screen. FR-010 is the canonical post-save edit path.
  > Non-MVP note: whether the pre-save editing screen appears is a user-toggleable setting — it can be switched on or off per user preference.
- FR-008: App auto-saves extracted tasks to the user's account after processing. Priority: must-have
  > Socrates: Counter-argument accepted: "an explicit save button is a redundant tap." Updated: auto-save on extraction completion; no manual save button.

### Task Management
- FR-009: User can navigate tasks via three tabs: To-Do (active), Done (completed), Deleted (soft-deleted). Priority: must-have
  > Socrates: Counter-argument accepted: "mixing completed and incomplete tasks creates visual noise." Updated: three explicit tabs — To-Do, Done, Deleted — give each task state a dedicated view; To-Do is the default.
- FR-010: User can edit an existing saved task. Priority: must-have
  > Socrates: Counter-argument considered: "post-save editing duplicates FR-007." Resolution: kept and confirmed as canonical edit mechanism; FR-007 is optional pre-save, FR-010 is always-available post-save.
- FR-011: User can mark a task as done, which moves it to the Done tab. Priority: must-have
  > Socrates: Counter-argument accepted: "done tasks remaining in the main list kill the sense of progress." Updated: marking done moves the task to the Done tab.
- FR-012: User can delete a task, which moves it to the Deleted tab (soft delete — recoverable). Priority: must-have
  > Socrates: Counter-argument accepted: "hard delete without undo causes permanent accidental data loss on mobile." Updated: deletion is soft — tasks move to the Deleted tab and can be restored; no immediate permanent deletion.
- FR-014: User can search tasks by keyword or phrase across all tabs. Priority: must-have

## User Stories

### US-01: Voice-to-task primary flow
**Given** a logged-in user on mobile or desktop,
**When** they record a voice note and stop recording,
**Then** the app automatically transcribes the audio, extracts individual tasks, and saves them to the user's active task list — all within 10 seconds, with at least 80% of tasks requiring no correction.

## Business Logic

**Domain rule**: Given a spoken utterance, the app identifies and extracts each distinct actionable item as a separate task, regardless of how they were phrased or combined in speech.

The rule consumes raw transcribed text as its input. Its output is an ordered list of task strings — one per distinct actionable item detected. The user encounters the output immediately after recording stops: the app presents the extracted list before the user interacts with it further. The rule does not merge similar items, infer implicit tasks, or filter non-task content — it extracts only what was explicitly stated.

## Non-Functional Requirements

- **Response time**: The full voice-to-task-list flow completes in under 10 seconds as perceived by the user (measured from recording stop to task list appearing on screen).
- **Platform**: The app works on mobile browsers (iOS Safari, Android Chrome) and desktop browsers without requiring a native app install.
- **Task extraction accuracy**: At least 80% of extracted tasks require no manual correction by the user.
- **Voice data privacy**: Raw audio is not persisted after transcription completes — only the extracted task strings are stored.
- **Connectivity resilience**: The app remains usable on slow mobile connections (3G / weak WiFi); degraded connection produces a clear error state rather than a silent hang.
- **Language support**: AI pipeline supports Polish and English. Other languages are out of scope for MVP.

## Non-Goals

- No calendar integration (Google Calendar, Apple Calendar) — task data lives only in Tellme; no external sync.
- No push notifications or reminders — users check the task list manually; no background alerting in MVP.
- No multi-language support beyond Polish and English — AI pipeline is scoped to these two languages only.
- No sharing or collaboration — task lists are private to each individual user account.
- No AI prioritisation or scheduling — the app extracts tasks but does not rank, order, or suggest when to complete them.
- No offline mode — transcription and extraction require cloud API calls; no offline fallback.

## Quality Cross-Check

All 5 greenfield quality gates passed on 2026-06-09. Quality check status: accepted.

## Open Questions

- **OQ-01: Native app vs. mobile web**: FR-003 references "the browser" but `product_type` is `mobile`. Whether voice capture is implemented via Web Audio API (mobile web), React Native audio libraries, or a platform-native SDK is unresolved. To be decided during tech stack selection — the answer determines the entire build toolchain.
- **OQ-02: Google OAuth in a native mobile app**: Google Sign-In in a native app requires platform-specific OAuth setup (Google Identity Services for Android, GoogleSignIn SDK for iOS, or an auth wrapper like Firebase Auth / Supabase Auth). The integration path depends on the stack chosen in OQ-01.
