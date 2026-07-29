# STACK — Start Here

This packet is the source of truth for building **STACK**, a very small mobile-first running plan app.

## What to do first

1. Create a private GitHub repository named `stack-run`.
2. Copy the entire contents of this packet into the repository root.
3. Commit the documentation and reference image before asking an agent to write application code.
4. Connect the repository to the coding agent.
5. Give the agent the **Phase 0 prompt** from `docs/AGENT_PROMPTS.md`.
6. Complete one phase per branch and pull request.
7. Do not begin the next phase until the current phase passes its exit gate.

## Authority order

When documents conflict, use this order:

1. `docs/PRODUCT_AND_SCOPE.md`
2. `docs/UX_PRODUCT_SPEC.md`
3. `docs/DATA_AND_STORAGE.md`
4. `docs/ENGINEERING_STANDARDS.md`
5. `docs/IMPLEMENTATION_ROADMAP.md`
6. `docs/UI_IMPLEMENTATION_PLAN.md`
7. `docs/AGENT_PROMPTS.md`
8. Existing code

Existing code is evidence of current behavior. It is not permission to violate locked product decisions.

## Core rule

STACK is not a fitness platform. It is a focused visual completion tool for one race plan.

The first release has only three primary screens:

- Today
- Build
- Plan
