# Task lifecycle

- Use only these task states in order: `blocked`, `ready`, `in-progress`, `done`, `verified`.
- Never skip a state or work on more than one task unless the delivery plan explicitly allows it.
- Set a task to `in-progress` before changing implementation.
- Set it to `done` only after implementation and checks complete.
- Set it to `verified` only after evidence proves every linked acceptance criterion.
- Update the Progress log and Completion matrix whenever task state or evidence changes.
