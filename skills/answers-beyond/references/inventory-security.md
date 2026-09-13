# Inventory security

Set `ABEC_PRIVATE_DIR` to a user-controlled directory that is excluded from Git, cloud sync, chat attachments, and ordinary project searches.

For generated inventory:

1. Choose a file beneath `ABEC_PRIVATE_DIR`.
2. Generate locally with count, length, prefix, and ambiguity settings.
3. Preview the import. Return only file path, count, batch name, and warnings.
4. After explicit confirmation, execute the exact receipt.
5. Re-read the server's masked inventory count.

For imported inventory, normalize whitespace and duplicates locally. Never expose full values to the model context. If a requested file is outside `ABEC_PRIVATE_DIR`, stop and ask the user to move it into the private directory.
