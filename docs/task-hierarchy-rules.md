# Task hierarchy rules

## Entities

- `Project`: long-lived outcome, such as one competition or scholarship application.
- `Milestone`: a meaningful stage or externally visible checkpoint.
- `WorkPackage`: an optional grouping for several closely related actions inside a stage.
- `Task`: an executable verb plus a concrete object.
- `Subtask`: at most one level below a task; used only when completion needs separately checkable actions.
- `Material`: a required object, not an action.
- `TimePoint`: a deadline or occurrence time, not a task.
- `Event`: attendance/schedule information; preparation deliverables remain tasks.

## Split rules

Split when deliverables, deadlines, operation channels, stages or dependencies differ. Do not split background explanations, format restrictions, contacts, addresses or multiple descriptions of the same deliverable. The post-processor merges identical action/object/deadline/deliverable combinations and flags over-fragmentation.

## Inference rules

Every suggestion is labeled `explicit`, `strong_inference` or `optional_suggestion`. Only explicit tasks are selected by default. Strong inference and optional suggestions remain visible for manual opt-in. Missing or relative dates always require confirmation.

## Project matching

Matching considers title tokens, category, active status and existing source/task context. The recognizer returns reasons and confidence. It may suggest a new project, an existing project, a standalone task or `uncertain`; it never merges projects automatically.
