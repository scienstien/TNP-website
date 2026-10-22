# Shared implementation queue

This file is the repository-level task board for work that must be coordinated
across agents and computers. Read `AGENTS.md` first; it remains the source of
project scope, architecture, data rules, security requirements, and engineering
standards. This file records only explicitly requested implementation work and
its execution order.

## Task-entry policy

- Add a task only when the project owner explicitly requests that specific task.
- Do not infer, invent, expand, or pre-populate work from code review findings,
  comments, warnings, or the remaining-work sections of other documents.
- Agents may update the owner, status, validation, and handoff notes of an
  existing task while working on it.
- If an existing task needs materially broader scope, record the proposed change
  in its notes and wait for the project owner's decision.
- Keep task IDs stable after they have been assigned.

## Execution order

Work is selected in this order unless the project owner explicitly overrides it:

1. **P0 — Blocking:** Prevents the application, another approved task, shared
   integration, or required validation from proceeding.
2. **P1 — Important, non-blocking:** Required product or engineering work that
   should follow ready P0 work but does not stop unrelated work.
3. **P2 — Optimization:** Performance, maintainability, cleanup, or polish that
   can safely wait until the required behavior is working and validated.

Within one priority, complete dependency-ready tasks before tasks whose
dependencies are unresolved. Do not begin a task already owned by another agent
without coordinating ownership first.

## Status values

| Status | Meaning |
| --- | --- |
| `READY` | Scope and dependencies are clear; implementation may begin. |
| `IN_PROGRESS` | An identified owner is actively implementing it. |
| `BLOCKED` | Work cannot continue until the recorded blocker is resolved. |
| `VALIDATION` | Implementation is complete and required checks are running or awaiting review. |
| `DONE` | Acceptance criteria and validation are complete, with handoff recorded. |
| `PAUSED` | The project owner explicitly paused the task. |

Priority and status are different: a P0 task can be `READY`, while a P1 task can
have a `BLOCKED` status.

## P0 — Blocking

_No tasks recorded._

## P1 — Important, non-blocking

_No tasks recorded._

## P2 — Optimization

_No tasks recorded._

## Task template

Copy this template into the appropriate priority section only after the project
owner specifies the task.

```md
### [TASK-ID] Task title

- Status: READY
- Owner: Unassigned
- Requested by: Project owner
- Dependencies: None
- Blocks: None
- Scope/files: To be confirmed

#### Context

Why this work is needed and the repository state it depends on.

#### Required outcome

The exact behavior, artifact, or contract requested by the project owner.

#### In scope

- Explicitly approved work only.

#### Out of scope

- Related work that must not be included in this task.

#### Acceptance criteria

- Observable conditions that must be true before marking the task done.

#### Validation

- Commands, tests, inspections, or reviews required.

#### Handoff notes

- Files changed:
- Contracts changed:
- Validation results:
- Known limitations:
- Follow-up required:
```

## Cross-computer workflow

1. Pull or inspect the latest agreed branch before taking ownership.
2. Confirm the task is present here and dependency-ready.
3. Set its owner and status to `IN_PROGRESS` before editing shared files.
4. Keep implementation within the recorded scope and `AGENTS.md` boundaries.
5. Record validation results and handoff details before setting `DONE`.
6. Commit and push the task-board update with the related reviewed changes so
   other computers receive the same state.

## Completed-task archive

Move completed entries here only when the active sections become difficult to
scan. Preserve their task IDs, acceptance criteria, validation results, and
handoff notes.

_No archived tasks._
