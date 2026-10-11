# Phase 3D Report: Runtime Form Preview and Validation

## Status

**PHASE 3D STATUS: PASS**

Configured forms can be previewed and metadata-validated in the authorized CRM
workspace. This preview is explicitly non-persistent: it does not replace
operational forms, invoke operational CRUD actions, or store custom field
values.

## 1. Protected preview route

- `/crm/configuration/[moduleKey]/preview/[formKey]` resolves metadata on the
  server and returns not found when the module or form is unavailable.
- The resolver obtains the active CRM using `getCrmTenantContext(FORMS_READ)`,
  separately requires `FIELDS_READ`, and scopes its nested database read to
  that CRM and module.
- The form editor links to preview only when the form is enabled.
- The page and renderer clearly identify the feature as preview/validation
  only and state that nothing is saved.

## 2. Metadata rendering

The renderer handles all nine configured field types: `TEXT`, `TEXTAREA`,
`NUMBER`, `EMAIL`, `PHONE`, `DATE`, `DATETIME`, `BOOLEAN`, and `SELECT`.
Labels are associated with their controls, required fields have a visible
indicator, enabled SELECT options are rendered, and appropriate browser
constraints are set where applicable. Validation errors are associated with
their controls and announced through accessible status text.

Disabled fields are omitted from the renderer but retained by the server-side
form representation so forged submissions for those fields are rejected.
Disabled SELECT options are omitted and cannot pass server-side option
validation.

## 3. Server-side validation

`src/lib/crm/runtime-validation.ts` validates required values, text length,
numeric ranges, email format, dates and datetimes, booleans, SELECT membership,
patterns, unknown field keys, and disabled field submissions. It normalizes
values for preview display only. Invalid pattern metadata is reported as a
validation-configuration error rather than causing a successful result.

The preview Server Action re-resolves the authorized form on each submission.
It binds module/form keys from the server-rendered route, validates only
`field:<key>` entries, rejects unexpected and duplicate field submissions
through normal validation, and treats an absent BOOLEAN checkbox as `false`.
It performs no database writes. Existing Company, Contact, Lead, and Task
forms and actions remain unchanged.

## 4. Tenant and permission boundaries

The resolver uses the existing CRM context and permission helpers and makes a
single bounded nested read for the CRM module, form, form fields, fields, and
options. It checks tenant/module ownership in the returned metadata and rejects
inconsistent field or option associations. No client-supplied CRM ID is used
for authorization.

## 5. Schema and persistence

No schema changes or migrations were needed. No custom field values are
persisted, and the preview action does not create or update operational
records.

## 6. Focused checks

- Runtime validation checks passed for valid normalization, all nine field
  types, required/text/numeric constraints, invalid date/time and email values,
  pattern validation, unknown and disabled fields, and invalid SELECT values.
- Resolver checks passed for server-resolved CRM context, `FORMS_READ` and
  `FIELDS_READ` enforcement, CRM/module-scoped querying, required overrides,
  disabled-field tracking, and bounded nested selection.
- Source inspection confirmed the preview action only validates and returns
  values; it contains no write operation and does not call operational CRUD
  actions.

## 7. Validation results

| Check | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — all 12 migrations applied |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — includes the protected preview route |
| Focused resolver and runtime validation checks | PASS |
| `git diff --check` | PASS |

## 8. Deferred work

- Persisting custom field values or replacing operational forms
- Dynamic record creation/update and operational CRUD from configured forms
- Conditional logic, workflows, dashboards, and automation
- File, calculated, and relationship field types
- Configuration versioning and audit history
