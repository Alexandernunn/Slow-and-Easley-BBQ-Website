---
name: Netlify CLI in monorepos
description: Avoid interactive project selection and ambiguous package executables when checking Netlify functions locally.
---

For noninteractive local Netlify commands in a pnpm monorepo, select the `netlify` executable explicitly when invoking the CLI package and pass `--filter` for the intended workspace app.

**Why:** The CLI package exposes multiple binaries, so a plain one-off package invocation fails. Once the executable is selected, monorepo autodetection prompts for an app; noninteractive shells then fail before building any functions.

**How to apply:** For local function packaging or dev-server checks, use the CLI's explicit executable and workspace app filter. Keep the root Netlify configuration as the source of truth; do not invent a second configuration just to bypass the prompt.