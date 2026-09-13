# Product workflow

## Required discovery

Collect or infer, while labeling assumptions:

- `sku`: stable member-owned identifier.
- `name`: customer-facing product name.
- `description`: concise promise and boundary.
- `delivery.type`: `manual_review`, `direct_delivery`, or `account_activation`.
- Delivery configuration and customer instructions.
- Source URLs used as evidence.
- Publication intent: default `draft`.
- Card mode: `none`, `generate`, or `import`.

Do not ask for fields already present in user-provided material. Group genuinely missing questions into one short request.

## Execution sequence

1. `abec_whoami`.
2. `abec_list_products` to detect duplicate SKU/name.
3. Build and validate a v1 manifest.
4. Call `abec_create_product_preview` or `abec_update_product_preview`.
5. Present the preview in plain language.
6. Obtain explicit confirmation.
7. Call `abec_confirm_operation` with the exact fresh receipt.
8. Read the product back and report durable state plus `requestId`.

When a user asks to “上线”, clarify whether they mean creating a draft, activating the product, adding inventory, or all three. These are distinct state changes.
