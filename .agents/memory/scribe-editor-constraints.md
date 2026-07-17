---
name: Scribe editor constraints
description: Hard constraints on the Scribe (mobile) editor's TextInput architecture.
---

## Rule
Keep the TextInput in **controlled mode** (`value={content}`). Do NOT switch to uncontrolled (`defaultValue`) to fix performance.

**Why:** A previous attempt at uncontrolled mode caused IME composition bugs, text duplication, and dropped spaces on real Android devices. The repo's `.agents/memory/` files document this failure in detail.

**How to apply:** Any future paste-lag or performance work must stay within controlled mode. Use `startTransition`, memoisation, or native bridges — not uncontrolled TextInput.
