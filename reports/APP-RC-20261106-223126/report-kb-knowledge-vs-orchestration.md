---
session: APP-RC-20261106-223126
type: fireside
topic: KB as a knowledge base or an orchestration tool
time: 2026-11-15 14:28
participants: Peter, APP-RC-20261106-223126
---

## Context

KB was designed as a system that collects knowledge, and it was a deliberate decision **not** to turn it into JIRA or a process tool. Since then, process features have grown into it: case statuses with caller-side transition rules, claims with leases, flags with kinds (respond, implement), the Answer box's "send back", and queue views. Peter: "This is what we just did."

What brought it up: FR-YAC found that answering a case's open questions in KB's Answer box re-raises the case's **respond** flag (send-back is on by default, an interim choice). So an answered case comes back to the queue as another respond task when it is ready to implement. The fix FR-YAC proposed straddles two systems: KB's send-back should raise an implement flag or none, and the queue (`wq`) should show the case as ready to implement.

The process information is spread out: some on KB's landing page, some in search, some on the case page, some in `case-fetch` claims, some in FR-YAC's `wq`.

Peter addressed the question to KB-YAC; it reached APP-RC by mistake. APP-RC's input is recorded here for Peter to review with KB-YAC and Claude.

## Options Considered

**a) KB becomes knowledge base and orchestration tool.** Accept the change of direction on purpose. Add a page for the process side and gather what is now spread across the landing page, search and the case page.

- For: cheapest now; one app, one data model, no new API surface.
- Against: makes the drift official. Every new process feature (worker types, implement flags, parking, routing, dashboards) grows inside KB and bends its model toward the workflow. That's the sidecar-model failure, inside the knowledge app.

**b) Clean separation.** KB goes back to collecting all kinds of information and keeps the flags. A separate process-coordination app does all the orchestration, reading and writing KB through its API, as `kbc` does. It focuses on manipulating flags and on specific dashboards. It could also route implementation tasks between Peter's local LLM and Claude, and show status and the queue, which FR-YAC does today.

- For: the same principle WIP applies to itself (Vision.md: WIP is not a workflow engine; workflows belong in tools that use its APIs), applied one level up.
- Against: a second app, and an API contract between the two that someone must own.

## APP-RC's view (input, not a decision)

APP-RC recommended **b, staged**, speaking as a consumer of KB through `kbc`. The reasoning:

- **Where the line goes.** "What is known" stays in KB: cases, responses, decisions, lessons, sessions, firesides, memories. These stay valuable after the work ends. "Who does what next" moves to the coordinator: claims, leases, flags, queue entries, worker registrations, routing. That state matters only while work is in flight.
  - **Case status** is borderline. It stays in KB, since "implemented" is a fact about a case, but the coordinator writes it.
  - The coordinator's process records live in **its own namespace** and refer to KB documents by ID. WIP's cross-namespace references and read gates already support this.
- **The strongest single argument: one place enforces status transitions.** Today the served playbook says transition validity "is enforced caller-side". Every agent carries its own copy of the state machine in a markdown playbook, and each copy can drift. A coordinator would hold the only one.
- **Evidence from APP-RC's own work this session:**
  - Implementing one case touched the case page, the claims in `case-fetch` and `wq`.
  - The send-back behaviour above is process logic in KB's UI, and FR-YAC had to work around it.
- **Proposed stages, so nothing breaks:**
  1. **Decide the line explicitly** and write it down, listing which records move. This is Peter's "change a decision consciously".
  2. **A read-only coordinator first:** queue, claims and dashboards, read from KB through the API. It replaces the scattered pages and risks nothing.
  3. **Move the process writes:** claims, flag raising and send-back. KB's Answer box stops raising flags itself.
  4. **Status transitions** go through the coordinator only. The playbook's caller-side rules shrink to "call the coordinator".

  `kbc` keeps working throughout; it gains a second target for process calls.
- **Caveat APP-RC stated:** this is a client's view. APP-KB knows KB's internals and the cost of moving flags out, and FR-YAC knows what the queue really needs. Stages 3 and 4 need their input.

## Decision

None yet. Peter will review the options and APP-RC's input with KB-YAC and Claude.

## Deferred

- The choice between a and b.
- **If b:**
  - who owns the coordinator and its API contract;
  - whether flags move out of KB or stay there with the coordinator as their only writer. Peter's wording kept the flags in KB; APP-RC's line would move them;
  - where the local-LLM / Claude routing lives;
  - how FR-YAC's current `wq` work folds in.
- **What happens to the Answer box's send-back** in the meantime.

## Peter's Voice

- "When KB was designed, it was a decision to not turn it into JIRA or a process tool. This is what we just did."
- "There is nothing wrong in changing a decision, but it helps to make it consciously."
- On option b: "KB goes back to be a system that collects all kinds of information. It keeps the flags, but all the process orchestration is done via a process-coordination app."
- On where this goes next: "This question was meant to land at KB-YAC, but your input is valid and valuable."

## Impact

- **KB (APP-KB):** under b, KB's process features (send-back, flag kinds, queue views) stop growing there and later move out. Under a, KB gets a process page and its model takes on the workflow.
- **FR-YAC:** under b, `wq` and the routing between the local LLM and Claude become the coordinator's job, or move into it.
- **Every agent using `kbc`:** under b, the playbook's caller-side transition rules eventually give way to coordinator calls. Nothing changes until stage 3.
- **WIP:** no platform change in either option. Both are app-level, built on existing primitives (namespaces, documents, cross-namespace references).
