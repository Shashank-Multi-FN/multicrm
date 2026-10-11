# Phase 3E Report: Custom Field Value Persistence Foundation

## Status

**PHASE 3E STATUS: PASS**

Custom field values now have a tenant- and module-isolated persistence
foundation with explicit operational-record foreign keys, typed storage,
server-side validation and authorization, and database cascade cleanup.
Existing operational forms and their CRUD Server Actions were not replaced or
modified.

## 1. Persistence architecture

Company, Contact, Lead, and Task are separate Prisma models and have no shared
record supertype. A single polymorphic record ID would not have a real database
foreign key to its target. The implementation therefore uses four explicit
tables: `CustomCompanyFieldValue`, `CustomContactFieldValue`,
`CustomLeadFieldValue`, and `CustomTaskFieldValue`.

Each value table has a direct composite foreign key to its corresponding
operational record using `(crmInstanceId, recordId)`, and a composite foreign
key to the field definition using CRM, module, field ID, field type, and origin.
The table's module key is fixed by a database check constraint. This means the
field and operational record must belong to the same CRM and the same
supported module; no client-supplied CRM or module can create the association.

## 2. Prisma schema and migration

The schema adds the four value models and reverse relations. Compound unique
keys were added to operational record IDs, field definitions, and field
options so PostgreSQL can enforce the composite foreign keys. Each value table
has a unique CRM/module/record/field key, preventing duplicate values, and a
field-first index for reverse field/record lookup. The unique index's
CRM/module/record prefix supports record-scoped reads.

Migration `20261004220500_custom_field_value_persistence` is additive. It
creates empty tables, indexes, composite foreign keys, and database checks; it
does not drop columns or tables, update existing records, or delete data.
The compound unique keys on existing IDs are safe because those IDs are
already primary keys. The migration was inspected before application and
applied with `npx prisma migrate deploy`; no database reset was used.

The migration includes SQL `CHECK` constraints for fixed module identity,
CUSTOM-only values, and exactly one correctly typed value column. Prisma's
schema language does not express these checks, so the SQL migration remains
their source of truth. Prisma schema-to-database diff reports no difference.

## 3. Type handling

Values are stored in explicit columns:

- `TEXT`, `TEXTAREA`, `EMAIL`, and `PHONE`: text
- `NUMBER`: PostgreSQL double precision
- `BOOLEAN`: boolean, including `false`
- `DATE`: PostgreSQL `DATE`
- `DATETIME`: PostgreSQL `TIMESTAMP(3)`
- `SELECT`: a foreign key to the selected `CrmFieldOption`; the option key is
  accepted as the stable input, but the option ID is stored. Labels are not
  stored as authoritative values.

Database checks require the column matching the field type to be non-null and
all other value columns to be null. SELECT option references are composite and
must match the same CRM, module, and field.

`DATETIME` currently preserves the wall-clock value submitted by a
`datetime-local` control in a timestamp without timezone. Defining user/CRM
timezone conversion is deferred until there is an explicit timezone policy.

## 4. Validation and authorization

`src/lib/crm/custom-field-values.ts` is a server-only service. Each operation:

1. Resolves the authenticated user's active CRM through the existing CRM
   tenant context.
2. Reads the field by ID and resolved CRM; requires a CUSTOM, enabled field
   and an enabled CRM module.
3. Derives the module and its permission from the stored field definition.
   Only the existing `COMPANIES_UPDATE`, `CONTACTS_UPDATE`, `LEADS_UPDATE`,
   or `TASKS_UPDATE` permission is used. `FIELDS_MANAGE` does not authorize
   operational value writes.
4. Reuses the Phase 3D runtime validator for required values, type,
   constraints, formats, and enabled SELECT-option membership.
5. Resolves the record from the model implied by the field's stored module,
   scoped to the resolved CRM.
6. Writes within a Prisma transaction.

Inputs contain only record ID, field ID, value, and—where required—value ID.
The service does not accept client-controlled CRM ID, module, field type,
field origin, or SELECT label. No current operational form or CRUD action was
changed.

## 5. Create, update, upsert, and delete

The service exports `createCustomFieldValue`, `updateCustomFieldValue`,
`upsertCustomFieldValue`, and `deleteCustomFieldValue`.

- Create is protected by the database uniqueness constraint and returns a
  conflict error for a duplicate record/field pair.
- Update scopes by value ID, resolved CRM, field-derived module, record ID,
  and field ID.
- Upsert uses the database compound unique key. An empty optional value
  clears the existing value; creating an empty optional value is rejected.
- Delete re-resolves the field and record, checks the same operational update
  permission, and scopes deletion by value ID plus CRM/module/record/field.

## 6. Cleanup behavior

Database `ON DELETE CASCADE` behavior removes values when:

- A custom field definition is deleted.
- A referenced SELECT option is deleted.
- Its Company, Contact, Lead, or Task record is deleted.

These cascades apply to existing metadata and operational deletion paths
without changing their Server Actions. Disabling an option does not erase
existing values; new writes reject disabled options.

## 7. Security and regression tests

`node --test scripts/custom-field-values.test.cjs` passed all 9 focused
mocked tests, covering same-CRM writes, foreign CRM fields and records,
cross-module records, SYSTEM and disabled fields, invalid values for all
types, SELECT validation, missing operational permission, CRM_MEMBER ownership
checks, duplicates, scoped update/delete, and upsert/clear behavior.

Additional tests against the configured development PostgreSQL database used
temporary fixtures and rolled them back or removed them:

- Seven expected database rejections passed for cross-CRM field/record links,
  cross-module fields, SYSTEM fields, mismatched typed storage, cross-CRM
  SELECT options, and duplicate values.
- Field and record deletion cleanup passed for all four operational models.
- Live Prisma service checks passed for all nine typed values, CRUD/upsert,
  uniqueness, authorization/tenant/module/record scoping, and option cleanup.
- Company, Contact, Lead, and Task create/update/delete smoke checks passed;
  their transaction was rolled back.

## 8. Migration and validation results

| Check | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — all 13 migrations applied |
| `npx prisma migrate diff --exit-code --from-config-datasource --to-schema prisma/schema.prisma` | PASS — no difference detected |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `node --test scripts/custom-field-values.test.cjs` | PASS — 9 tests |
| Rollback-only database integrity and CRUD checks | PASS |
| `git diff --check` | PASS |

## 9. Existing operational CRUD status

The Company, Contact, Lead, and Task forms and Server Actions remain
authoritative and were not modified for this phase. Application build and
database create/update/delete smoke checks passed. Custom field values are not
yet rendered in or submitted by operational forms.

## 10. Deferred work and recommended Phase 3F

- Read/render custom values in operational record details and edit flows.
- Integrate values into an explicitly selected operational form only after
  preserving its existing validation and permissions.
- Define CRM/user timezone semantics for DATETIME.
- Define behavior for retaining or clearing values when fields are disabled,
  options are disabled, or configuration changes.
- Add value audit history, bulk operations, and search/report integration if
  required by the next phase.

This phase does not implement generalized dynamic CRUD, custom-value UI,
conditional logic, workflows, dashboards, automation, or file/calculated
fields.
