---
project: Tellme
version: 1
status: draft
created: 2026-06-10
context_type: greenfield
product_type: mobile
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 2
  hard_deadline: null
  after_hours_only: false
---

## Vision & Problem Statement

Voice memos are fast to record but slow to process — they require re-listening and manual transcription before anything is actionable. This is a workflow friction problem: the capture step works, but the transcription-to-task step is the bottleneck that kills follow-through. Either the thought is lost, or it ends up in a voice memo that accumulates with others, creating a secondary backlog that needs manual processing before any task can be acted on.

The insight behind Tellme: the moment a person speaks a list of things they need to do, those words already contain everything needed to produce a task list. The human cost is entirely in the step between speaking and having an actionable, editable list. Eliminating that step is the product's entire value.

## User & Persona

**Primary persona**: A busy individual who uses TODO lists regularly and captures ideas on the go. They reach for this product in the moment when an idea or task strikes but typing is inconvenient — walking, driving, cooking, or otherwise occupied. They already use voice recording as a capture shortcut today, but lose value in the gap between recording and having an actionable task list.

**Persona context**: The product owner is the initial user. Target audience extends to freelancers, office workers, and students who share the same capture-then-process pattern.

## Success Criteria

### Primary
- User opens the app, records a voice note, and receives a structured task list within 10 seconds of stopping the recording.
- At least 80% of generated tasks require no manual correction.
- User can edit, mark as done, and delete tasks from the list.
- Tasks are organised across three tabs (To-Do, Done, Deleted) and are searchable by keyword.
- This full flow working end-to-end = the product works.

### Secondary
- User can review and inline-edit extracted tasks before they are committed to the list, allowing immediate tweaks to AI output after extraction.

### Guardrails
- Voice recording must work on mobile devices as the primary use case; the on-the-go capture scenario must not require a desktop.
- The specific recording mechanism (native app vs. mobile web) is unresolved — see Open Questions #1.

## User Stories

### US-01: Voice-to-task primary flow

- **Given** a logged-in user on a mobile device or desktop
- **When** they record a voice note and stop recording
- **Then** the app automatically transcribes the audio, extracts individual tasks, and saves them to the user's To-Do tab — all within 10 seconds, with at least 80% of tasks requiring no correction

#### Acceptance Criteria
- Each distinct actionable item in the spoken utterance becomes a separate task.
- The task list appears without requiring any additional user action after stopping the recording.
- If extraction produces no tasks or fails, the user sees a clear error state rather than a silent empty list.

### US-02: Task state navigation

- **Given** a logged-in user with tasks in various states
- **When** they tap the To-Do, Done, or Deleted tab
- **Then** they see only tasks in that state, and can search within any tab by keyword or phrase

#### Acceptance Criteria
- To-Do tab shows only active (incomplete) tasks.
- Done tab shows only tasks marked as done.
- Deleted tab shows only soft-deleted tasks (recoverable from this tab).
- Search filters the visible list to tasks whose text contains the entered phrase; empty search shows all tasks in the current tab.

## Functional Requirements

### Authentication
- FR-001: User can register and log in with email + password or Sign in with Google (Google OAuth). Priority: must-have
  > Socrates: Counter-argument considered: "registration is overhead if the primary user is yourself." Resolution: kept; both auth paths (email/password + Google OAuth) give users flexibility. Note: email/password requires a password-reset flow to be complete.
- FR-002: User can reset their password via email. Priority: must-have
  > Socrates: No counter-argument; email/password without password reset creates a support dead-end when users forget credentials.
- FR-013: User can log out of their account. Priority: must-have
  > Socrates: Counter-argument considered: "logout is dead code in v1; token expiry handles security." Resolution: kept; basic session control is table stakes.

### Voice Capture
- FR-003: User can record a voice note on a mobile device or desktop. Priority: must-have
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
  > Non-MVP: whether the pre-save editing screen appears is a user-toggleable setting (on/off per user preference). Toggling this setting is post-MVP.
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
  > Socrates: Counter-argument accepted: "delete without recourse causes permanent accidental data loss on mobile." Updated: deletion is soft — tasks move to the Deleted tab and can be restored; no immediate permanent deletion.
- FR-014: User can search tasks by keyword or phrase across all tabs. Priority: must-have

## Non-Functional Requirements

- **Response time**: The full voice-to-task-list flow completes in under 10 seconds as perceived by the user, measured from recording stop to task list appearing on screen.
- **Platform**: The app is accessible on iOS and Android mobile devices as its primary platform; desktop access is supported. Specific implementation form is unresolved — see Open Questions #1.
- **Task extraction accuracy**: At least 80% of extracted tasks require no manual correction by the user.
- **Voice data privacy**: Raw audio is not retained after processing completes — only the extracted task strings are persisted.
- **Connectivity resilience**: On a degraded connection (3G / weak WiFi), the app produces a clear error state rather than a silent hang; partial results are not presented as complete.
- **Language support**: The AI pipeline supports Polish and English. Input in other languages may produce degraded results and is not a supported use case for MVP.

## Business Logic

Given a spoken utterance, the app identifies and extracts each distinct actionable item as a separate task, regardless of how they were phrased or combined in speech.

The rule consumes raw transcribed text as its input. Its output is an ordered list of task strings — one per distinct actionable item detected. The user encounters the output immediately after recording stops: the extracted list is presented before the user interacts with it further. The rule does not merge similar items, infer implicit tasks, or filter non-task content — it extracts only what was explicitly stated.

## Access Control

**Auth model**: Email + password (with password reset via email) and Sign in with Google, both available at registration and login. Tasks are tied to the authenticated user account and accessible from any device the user logs in to.

**Role model**: Flat. Every authenticated user sees only their own tasks. No admin or member roles in MVP. Unauthenticated requests cannot access any task data.

Note: the specific Sign in with Google integration path on mobile is unresolved — see Open Questions #2.

## Non-Goals

- **No calendar integration** (Google Calendar, Apple Calendar) — task data lives only in Tellme; no external sync in MVP.
- **No push notifications or reminders** — users check the task list manually; no background alerting in MVP.
- **No multi-language support beyond Polish and English** — the AI pipeline is scoped to these two languages; other languages are out of scope.
- **No sharing or collaboration** — task lists are private to each individual user account; no shared lists or multi-user access.
- **No AI prioritisation or scheduling** — the app extracts tasks but does not rank, order, or suggest when to complete them.
- **No offline mode** — transcription and extraction require cloud API calls; no offline fallback.
- **No toggleable pre-save editing setting** — FR-007 (pre-save review screen) is a nice-to-have that appears or not based on the implementation choice; the ability for users to toggle it on/off is post-MVP.

## Open Questions

1. **Native app vs. mobile web** — FR-003 and the Platform NFR reference recording and access on mobile, but the specific implementation form is unresolved. Is this a native iOS/Android app, a cross-platform app, or a mobile-first web app? This choice determines the entire build toolchain and must be resolved before implementation begins. To be decided during tech stack selection.

2. **Sign in with Google on mobile** — the integration path for Google OAuth in a mobile app varies significantly depending on the answer to Open Question #1. To be decided during tech stack selection once the platform approach is locked.

3. **Adoption resistance hypothesis** — no hypothesis was formed during shaping on why a user who already uses voice recording today would not switch to Tellme. Low-urgency for MVP but relevant for post-launch iteration. Owner: product owner. No blocking deadline.
