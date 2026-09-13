# Answers Beyond Public Agent Kit Implementation Plan

> **For Codex:** Use the executing-plans workflow and complete every task with test-first evidence.

**Goal:** Publish a safe, zero-dependency Agent Kit that lets an Answers Beyond member connect a general-purpose AI agent, understand the product workflow, and operate only their authorized products through the existing API.

**Architecture:** Keep the entitlement backend, Cloudflare configuration, D1 schema, and operator tooling private. Publish only a thin client layer: one Agent Skill for behavior and safety, one stdio MCP server for structured tools, one CLI fallback, one manifest format, and one cross-harness installer. API keys are supplied through `ABEC_API_KEY`; the kit never writes or prints them.

**Tech Stack:** Node.js 20+, CommonJS, built-in `fetch`, `node:test`, JSON Schema, GitHub Actions.

---

## Task 1: Define package and security boundary

**Files:**
- Create: `package.json`
- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `.gitignore`
- Create: `.github/workflows/verify.yml`
- Test: `tests/public-boundary.test.cjs`

**Steps:**
1. Write a failing test that scans publishable files for credential patterns and private infrastructure artifacts.
2. Add a package allowlist, supported Node version, one unambiguous executable, and verification scripts.
3. Add an MIT license and a security policy that tells users to report leaked credentials privately.
4. Run the boundary test and `npm pack --dry-run`.

## Task 2: Implement reusable API client and member CLI

**Files:**
- Create: `lib/client.cjs`
- Create: `cli/abec.cjs`
- Test: `tests/client.test.cjs`
- Test: `tests/cli.test.cjs`

**Steps:**
1. Write failing tests for required-key handling, request headers, structured API errors, and redaction.
2. Implement the zero-dependency client with `ABEC_API_URL`, `ABEC_API_KEY`, and request IDs.
3. Implement read commands and preview/confirm commands without embedding secrets.
4. Verify mock-server behavior and CLI exit codes.

## Task 3: Implement product manifest and local inventory safety

**Files:**
- Create: `agent/product-manifest.cjs`
- Create: `agent/local-codes.cjs`
- Create: `schemas/product-manifest.schema.json`
- Create: `examples/product-manifest.example.json`
- Test: `tests/product-manifest.test.cjs`
- Test: `tests/local-codes.test.cjs`

**Steps:**
1. Write failing tests for required product fields, normalized manifests, path traversal, and private-directory enforcement.
2. Implement manifest validation and safe local card-code loading.
3. Publish the schema and a non-secret example.
4. Verify that raw card codes never enter generated MCP tool descriptions or logs.

## Task 4: Implement the MCP capability layer

**Files:**
- Create: `mcp/server.cjs`
- Test: `tests/mcp.test.cjs`

**Steps:**
1. Write failing protocol tests for initialization, tool listing, read operations, preview operations, and exact-receipt confirmation.
2. Implement a dependency-free stdio MCP server with member-scoped ABEC tools.
3. Keep destructive operations behind API preview receipts and explicit confirmation.
4. Verify protocol output and error sanitization.

## Task 5: Create the standard Agent Skill

**Files:**
- Create: `skills/answers-beyond/SKILL.md`
- Create: `skills/answers-beyond/references/product-workflow.md`
- Create: `skills/answers-beyond/references/inventory-security.md`
- Create: `skills/answers-beyond/references/troubleshooting.md`
- Create: `evals/evals.json`
- Test: `tests/skill.test.cjs`

**Steps:**
1. Write failing structural tests for YAML frontmatter, trigger coverage, capability fallback, confirmation rules, source-link handling, and a dated Learnings section.
2. Write a concise main Skill and move detailed guidance to routed references.
3. Add three realistic evaluation prompts covering source-link onboarding, bulk code generation, and permission/conflict diagnosis.
4. Run structural tests and an independent Agent evaluation against the prompts.

## Task 6: Implement cross-harness setup and doctor

**Files:**
- Create: `bin/answers-beyond-agent-kit.cjs`
- Create: `lib/setup.cjs`
- Create: `install.ps1`
- Test: `tests/setup.test.cjs`
- Test: `tests/doctor.test.cjs`

**Steps:**
1. Write failing tests for Codex, Claude Code, OpenCode, Cursor/generic adapters, dry-run behavior, and idempotency.
2. Implement `setup`, `doctor`, `print-config`, and CLI passthrough commands.
3. Install the Skill into harness-appropriate locations; register MCP where a supported CLI is available, otherwise generate a key-free configuration snippet.
4. Add a Windows installer that prompts securely and never echoes the key.
5. Verify a clean install inside a temporary home directory.

## Task 7: Document the one-command member journey

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`
- Test: `tests/readme.test.cjs`

**Steps:**
1. Write failing documentation tests for install, key setup, first read-only check, product draft, card inventory, and troubleshooting paths.
2. Document a short member flow and a separate Agent handoff prompt.
3. State the authorization boundary: the API key determines scopes; the Skill does not grant privileges.
4. Verify every documented command against the packaged artifact.

## Task 8: Publish and integrate

**Files:**
- Modify in private app: `src/lib/agentConnectionPack.ts`
- Modify associated tests and member dashboard copy.

**Steps:**
1. Run all tests, package inspection, secret scan, and a clean temporary-home installation.
2. Commit and create the public GitHub repository `Kvxw1105/answers-beyond-agent-kit`.
3. Create release `v1.0.0` and verify installation from the public repository.
4. Update the private member dashboard to point to the public release and describe Skill, MCP, CLI, and key setup separately.
5. Run app tests/build and deploy only through the protected ABEC staging-to-production workflow.

