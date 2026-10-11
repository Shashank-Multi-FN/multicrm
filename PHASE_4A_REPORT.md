# PHASE 4A REPORT

## 1. Status

PHASE 4A STATUS: PASS

CRM conditional rules are persisted per CRM/module/form, resolved from the
authorized CRM on the server, evaluated in the configured-form preview, and
re-evaluated during server-side validation. Existing operational CRUD and
custom-field persistence remain unchanged.

## 2. Data model

Added `CrmConditionalRule`, related to its `CrmForm` and source/target
`CrmFieldDefinition` records. Composite foreign keys bind each rule to the same
CRM and module as its form and fields. The stable rule identity is its generated
rule ID.

## 3. Rule schema

Each rule stores:

- CRM, module, and form identity
- Source and target field IDs
- Operator and action enums
- Optional comparison value
- Enabled state and display order
- Creation and update timestamps

Comparison values are stored as text after server-side normalization. Number
and boolean comparisons use canonical values; DATE and DATETIME values are
validated; SELECT values use the source option's stable key, never its label.

## 4. Supported operators

- `EQUALS`
- `NOT_EQUALS`
- `IS_EMPTY`
- `IS_NOT_EMPTY`

Text equality is exact and case-sensitive. Empty checks treat null, missing,
and whitespace-only strings as empty. Numeric comparisons compare finite numeric
values, and BOOLEAN comparisons accept only `true` or `false`.

## 5. Supported actions

- `SHOW`
- `HIDE`
- `REQUIRE`
- `OPTIONAL`
- `ENABLE`
- `DISABLE`

## 6. Evaluation engine

`src/lib/crm/conditional-logic.ts` is a pure reusable evaluator; it has no
database or React dependency. The same evaluator is used by the preview UI and
server validation.

## 7. Rule precedence

- Fields default to visible and enabled.
- If a field has enabled `SHOW` rules, it is hidden until at least one matching
  `SHOW` rule matches. A matching `HIDE` overrides any matching `SHOW`.
- If a field has enabled `ENABLE` rules, it is disabled until at least one
  matching `ENABLE` rule matches. A matching `DISABLE` overrides any matching
  `ENABLE`.
- A matching `REQUIRE` makes a field conditionally required only while visible
  and enabled.
- A matching `OPTIONAL` cancels conditional requiredness when both actions
  match. It does not override the form/schema-level required setting.
- Rules are evaluated against the submitted values in one deterministic pass;
  no recursive rule graph or arbitrary expression evaluation is performed.

## 8. Server-side validation

`validateCrmRuntimeForm()` evaluates the resolved rules again on the server.
Missing conditionally required values are rejected. A conditionally required
BOOLEAN must be checked.

The submission policy for hidden or disabled fields is **reject submitted
non-empty values**. Empty or omitted values are normalized to null. The preview
UI hides/disables those controls, but client behavior is not trusted for
authorization or validation.

## 9. Runtime integration

The controlled integration is the existing configured-form preview:

- `getCrmRuntimeForm()` resolves enabled rule metadata with the authorized CRM,
  module, and form and validates field references before returning the runtime
  form.
- `RuntimePreviewForm` uses the pure evaluator to respond to form input.
- The preview Server Action re-resolves the form and server-validates the
  submitted values and conditional state.
- The preview remains non-persistent and does not call operational CRUD.

Company, Contact, Lead, and Task operational forms were not converted or
rewritten. Their existing custom-field validation uses an empty rule set and
retains prior behavior.

## 10. Configuration UI

The existing CRM configuration editor now provides per-form rule creation,
editing, enabling/disabling, and deletion. Source and target choices are
restricted to enabled fields attached to that form. Comparison controls are
type-aware; SELECT choices show labels for usability but submit stable option
keys.

CRM members retain read-only configuration access according to the existing
role/permission checks.

## 11. Security and tenant isolation

- Every rule mutation enters through `getCrmTenantContext(FORMS_MANAGE)`.
- CRM identity comes from the authenticated active CRM, not submitted
  `crmInstanceId`.
- Form, source field, and target field are resolved from that CRM/module and
  the selected form's attached fields.
- Rule reads are scoped through the active CRM's module and form.
- Field type, origin, option keys, and labels are obtained from server-resolved
  metadata; forged browser values are ignored.
- Cross-CRM, wrong-module, detached-field, disabled-field, self-reference,
  unsupported operator/action, and invalid-option definitions are rejected.
- Disabling a field disables rules referencing it. Disabling a SELECT option
  disables rules comparing against its key. Referenced fields/options cannot be
  silently removed while rules still depend on them.
- Composite foreign keys enforce same-CRM/module relationships for the rule's
  form and source/target fields.

## 12. Tests

Added focused Node built-in tests in
`scripts/conditional-logic.test.cjs`, with no new test framework. Coverage
includes:

- All four operators and all six actions
- SHOW/HIDE and ENABLE/DISABLE precedence and gating
- REQUIRE/OPTIONAL precedence and schema-required preservation
- SELECT stable-key, BOOLEAN, NUMBER, DATE, and DATETIME comparisons
- Datetime-local comparison normalization
- Cross-CRM, wrong-module, detached, disabled, self-referential, and invalid
  option rejection
- Runtime rule resolution and fail-closed cross-CRM metadata
- Conditional required validation and forged hidden/disabled submissions
- CRM-scoped create/update/delete behavior and denied configuration mutation
- Forged client tenant, field type, origin, and field-key values

Both the new conditional-logic suite and existing custom-field regression suite
passed: 9 tests each.

## 13. Migration status

Two additive migrations were applied using `prisma migrate deploy`; no reset or
data deletion was performed:

- `20261005165000_align_phase_3h_schema` reconciles previously declared Phase
  3H schema state: it adds the existing configuration audit-log table and
  changes custom-value field/option foreign-key deletion policies from cascade
  to restrict. Existing foreign keys already guarded the references, and this
  migration preserves rows.
- `20261005170000_add_crm_conditional_rules` adds the conditional rule enums,
  table, indexes, and CRM/module/form/field foreign keys.

Migration status is clean and Prisma reports no schema difference.

## 14. Validation results

| Check | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — all 15 migrations applied |
| `npx prisma migrate diff --exit-code --from-config-datasource --to-schema prisma/schema.prisma` | PASS — no difference |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `node --test scripts/conditional-logic.test.cjs` | PASS — 9 tests |
| `node --test scripts/custom-field-values.test.cjs` | PASS — 9 tests |
| `git diff --check` | PASS |

## 15. Known limitations

- Conditional behavior is integrated into the configured-form preview and
  server-side preview validation only. Existing operational record-entry forms
  do not yet use configured `CrmForm` definitions.
- Preview submissions remain non-persistent by design.
- Equality is exact and case-sensitive for text; no AND/OR groups, nested
  expressions, or dependency graph evaluation are provided.
- DATETIME continues to use the existing local `datetime-local` semantics; this
  phase does not introduce timezone conversion or a storage migration.

## 16. Deferred work

- Applying configured-form conditional logic to operational CRUD forms, if
  explicitly adopted in a later phase.
- Workflow automation, notifications, webhooks, scheduled jobs, dashboards,
  arbitrary scripting, calculated fields, and other excluded functionality.
- Timezone normalization beyond current local DATETIME semantics.

## 17. Files changed

- `prisma/schema.prisma`
- `prisma/migrations/20261005165000_align_phase_3h_schema/migration.sql`
- `prisma/migrations/20261005170000_add_crm_conditional_rules/migration.sql`
- `src/lib/crm/conditional-logic.ts`
- `src/lib/crm/runtime-forms.ts`
- `src/lib/crm/runtime-validation.ts`
- `src/lib/crm/custom-field-values.ts`
- `src/app/(customer)/crm/companies/actions.ts`
- `src/app/(customer)/crm/configuration/actions.ts`
- `src/app/(customer)/crm/configuration/configuration-editor.tsx`
- `src/app/(customer)/crm/configuration/[moduleKey]/page.tsx`
- `src/app/(customer)/crm/configuration/runtime-preview-actions.ts`
- `src/app/(customer)/crm/configuration/runtime-preview-form.tsx`
- `scripts/conditional-logic.test.cjs`
- `scripts/custom-field-values.test.cjs`
- `PHASE_4A_REPORT.md`

PHASE 4A STATUS: PASS
