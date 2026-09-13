# Troubleshooting

Run checks in this order:

1. `node --version` is 20 or newer.
2. Skill path and generated MCP JSON exist.
3. The current process can see `ABEC_API_KEY`; never print its value.
4. `ABEC_API_URL` defaults to `https://ent.xince.work` and has no accidental path suffix.
5. Call `whoami` and retain `requestId`.
6. Compare the requested action with returned scopes.
7. List visible resources before diagnosing a missing ID.

For `403`, distinguish missing scope from wrong ownership. For `409`, discard the old receipt and preview against current state. For network or `5xx` errors, do not assume a write failed: use the idempotency key and read current state before retrying.
