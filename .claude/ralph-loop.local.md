---
active: true
iteration: 12
session_id: 
max_iterations: 55
completion_promise: "COMPLETE"
started_at: "2026-03-09T01:25:01Z"
---

Read .ralph/PROMPT.md for project context, .ralph/AGENT.md for commands, .ralph/fix_plan.md for tasks, and relevant specs from .ralph/specs/.

EXECUTION ORDER: Complete ALL manager-bot tasks (MB-01→MB-31) before starting any tg-client tasks (TC-01→TC-22).

EACH ITERATION:
1. Find the next unchecked [ ] task in fix_plan.md (MB first, then TC)
2. Read the relevant spec in .ralph/specs/ before implementing
3. Implement ONLY that one task
4. Run the appropriate test/lint command from .ralph/AGENT.md
5. MANDATORY: git add -A && git commit -m 'MB-XX: brief description'
6. Mark task as [x] in .ralph/fix_plan.md
7. Do ONE task per iteration, then stop

Output <promise>COMPLETE</promise> only when ALL 53 tasks are checked off in fix_plan.md.
