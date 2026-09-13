# Agent contribution instructions

This repository is the public, member-scoped client kit for Answers Beyond.

- Keep backend code, infrastructure identifiers, migrations, credentials, and operator-only workflows out of this repository.
- Never accept an API Key as a command-line argument or write it to generated configuration.
- Reads may run directly. Writes must preserve preview, exact receipt, explicit confirmation, idempotency, and read-back evidence.
- Raw card inventory must remain below `ABEC_PRIVATE_DIR` and must not appear in model-visible tool results.
- Add a failing test before changing behavior. Run `npm run verify` before release.
- Keep the main Skill concise; route details into `skills/answers-beyond/references/` and maintain its dated Learnings section.
