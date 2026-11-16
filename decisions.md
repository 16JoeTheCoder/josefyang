# decisions.md

Every decision made mid-build that Josef should know about. Newest at the bottom. Each entry: what, why, alternatives, how to reverse.

## 2026-11-16

### D1. Built unattended without plan sign-off
What: plan.md was written and building started straight away in the same run.
Why: Josef's scheduled task explicitly approved building now and waived the wait.
Reverse: review plan.md; anything you disagree with can be changed phase by phase.

### D2. PRODUCT.md inferred from the brief
What: /impeccable normally interviews you before writing PRODUCT.md. This run had no way to ask, so PRODUCT.md was written only from prompt/ and every inferred line is marked.
Reverse: run `/impeccable init` in a live session and correct it.
