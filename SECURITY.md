# Security Policy

## Reporting a Vulnerability

Provider tokens never leave the Host process: they are resolved only through
`ctx.credentials` and are never sent to the browser or logged. If you still
find a way credentials could leak, or any other vulnerability, please report
it privately by opening a GitHub issue with the "security" label or contacting
the maintainer directly. Do not open a public issue that exposes credential
material.

## Scope

- The Host-side HTTP route (`/subscription-usage`) and its credential handling.
- The Web client badge: it must never receive tokens, only usage summaries.

## Out of Scope

- The OpenAI Codex and OpenCode Zen Go services themselves; this project is
  not affiliated with them and their APIs may change without notice.
