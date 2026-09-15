# IMA review workflow

Use this workflow when an IMA knowledge-base application contains a purchase card issued by Answers Beyond.

## Boundary

- The proof is the existing long purchase card, for example `XX-************`; it is not the internal six-digit review code.
- The service normalizes and hash-matches the long card. It does not store the submitted plaintext proof.
- The Agent must not repeat the full card in prose or model-visible results. Report only `•••• TAIL`.
- The local Agent or harness may retain the original screenshot and tool arguments under its own history policy. Do not claim the complete workflow is log-free.
- The kit does not click IMA. A human must inspect the IMA application and click approve or reject there.

## Sequence

1. Run `abec_whoami`; require `reviews:read` for matching and `reviews:write` for state changes.
2. Inspect the screenshot or copied text and write the short-lived evidence under `ABEC_PRIVATE_DIR`. Candidates may be one per line, or the file may contain surrounding OCR text. Extract candidates that contain both letters and digits. Ignore dates, phone numbers, prices, order numbers, and six-digit internal review codes.
3. Call `abec_match_reviews` with `{ codesFile: "..." }`; the MCP tool intentionally rejects a raw `codes` array so the full proof does not enter tool arguments.
4. Report each masked tail and one server verdict:
   - `actionable`: valid manual-review card with an unfinished claim.
   - `not_redeemed`: card exists but the buyer has not claimed it in Answers Beyond. This is not an API failure and there is intentionally no six-digit review code yet. Return the `redeemUrl`, ask the buyer to claim with the original purchase card, and match again afterwards. Do not reimport the card or claim it on the buyer's behalf.
   - `duplicate`: the corresponding review was already completed; do not approve again.
   - `locked`: another operator is processing it.
   - `blocked`: refunded, revoked, rejected, abnormal, or not a manual-review product.
   - `not_found`: no accessible card matched.
5. For `actionable`, call `abec_review_action_preview` with `lock`. Show the masked tail, product, action, and fresh receipt impact. Wait for explicit confirmation before `abec_confirm_operation`.
6. Tell the human to finish the matching IMA application in the IMA GUI.
7. Only after the human says IMA was approved, preview `approve`, wait for explicit confirmation, execute the exact receipt, then call `abec_list_reviews` to verify the durable `duplicate` / completed state.

Reject, abnormal, and unlock follow the same preview, confirmation, execution, and read-back sequence. Never reuse a receipt after any state change.

## CLI fallback

Put current application proofs in a short-lived file under `ABEC_PRIVATE_DIR`, one code per line. Do not pass a full card as a command argument.

```powershell
answers-beyond-agent-kit abec reviews match --file "$env:ABEC_PRIVATE_DIR\ima-proof.txt"
answers-beyond-agent-kit abec reviews action 482731 lock --receipt "$env:ABEC_PRIVATE_DIR\lock.receipt.json"
# after human confirmation
answers-beyond-agent-kit abec reviews action 482731 lock --receipt "$env:ABEC_PRIVATE_DIR\lock.receipt.json" --confirm
```
