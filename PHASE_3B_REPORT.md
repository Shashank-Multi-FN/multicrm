# Phase 3B Report: Dynamic CRM Fields & Forms Foundation

## Pre-change architecture findings and design

### Existing structure

`prisma/schema.prisma` contains dedicated `Company`, `Contact`, `Lead`, and
`Task` models with relational CRM ownership through `crmInstanceId`. Existing
forms live in module-specific React components under
`src/app/(customer)/crm/companies`, `contacts`, `leads`, and `tasks`; their
Server Actions parse and validate fixed `FormData` fields and write the
dedicated Prisma models. These forms are operational and will remain unchanged.

Phase 3A provides `CrmModuleConfiguration`, uniquely keyed by
`(crmInstanceId, moduleKey)`, and `CrmNavigationItem` references it using that
same composite tenant/module boundary. Existing CRM role/permission policy is
defined in `src/lib/crm/permissions.ts`; authentication, organization and CRM
membership resolution is in `src/lib/auth/authorization.ts` and
`src/lib/crm/context.ts`.

The current operational fields are hardcoded in the Prisma models, form
components, and Server Action validation/write logic. The field list is not
yet connected to runtime record rendering or persistence.

### Schema design decisions

- Field definitions reference module configurations through the composite CRM
  and module identity. Their stable `key` is separate from their editable
  display `label`; duplicate keys are prevented within a CRM/module, while the
  same key can be reused in other CRMs.
- A controlled `CrmFieldType` catalog covers TEXT, TEXTAREA, NUMBER, EMAIL,
  PHONE, DATE, DATETIME, BOOLEAN, and SELECT.
- Fields distinguish `SYSTEM` from `CUSTOM`. System field metadata includes a
  backing application column identifier; custom fields do not use the
  operational model columns.
- Scalar validation metadata is stored as nullable properties directly on a
  field definition (required, min/max length, min/max value, pattern). This is
  the smallest representation for current requirements without building a
  validation engine.
- SELECT options use a separate option model linked through the field's
  composite CRM/module identity. This allows ordered values/labels without
  embedding options in app code or an opaque JSON column.
- Forms are CRM/module scoped, have a stable key, and connect to fields through
  a form-field join model carrying display order and an optional required
  override. Composite constraints enforce that the form and field belong to
  the same CRM and module.
- Existing create/edit forms are represented as metadata only. Existing
  components and Server Actions remain the only runtime form implementation in
  this phase.

This documents the inspected architecture and schema approach before applying
the Phase 3B schema migration.

## Phase 3B result

**PHASE 3B STATUS: PASS**

### 1. Existing hardcoded form architecture

The Company, Contact, Lead, and Task forms remain the existing React components
and Server Actions. Their current scalar inputs and validation are in
`company-form.tsx`/`companies/actions.ts`,
`contact-form.tsx`/`contacts/actions.ts`,
`lead-form.tsx`/`leads/actions.ts`, and
`task-form.tsx`/`tasks/actions.ts` under
`src/app/(customer)/crm/`. They continue to use the dedicated operational
Prisma models. No form renderer or operational write path was replaced.

Company/contact/lead/task foreign-key selectors (Company, Contact, Lead) remain
relational controls in the existing UI and are not modeled as configurable
fields in this phase; advanced relationship field types were explicitly
deferred.

### 2. Field definition model

`CrmFieldDefinition` is scoped by `(crmInstanceId, moduleKey)` and stores a
stable `key`, editable `label`, `fieldType`, origin, backing column, required
and enabled flags, display order, and validation metadata. A unique index on
`(crmInstanceId, moduleKey, key)` permits the same key in different CRMs or
modules while preventing duplicate keys within one CRM/module.

### 3. Field type catalog

The `CrmFieldType` enum provides exactly the initial supported types:
`TEXT`, `TEXTAREA`, `NUMBER`, `EMAIL`, `PHONE`, `DATE`, `DATETIME`, `BOOLEAN`,
and `SELECT`.

### 4. System vs custom fields

`CrmFieldOrigin` distinguishes `SYSTEM` and `CUSTOM`. System definitions record
their backing application column; custom field metadata has no application
column and does not alter operational table schemas or store values in JSON.
System metadata was seeded for the 24 scalar Company, Contact, Lead, and Task
columns currently represented in the existing forms/models. Existing
operational fields and records were not migrated or rewritten.

Future configuration operations must not delete a `SYSTEM` field or change its
stable key, origin, backing column, or incompatible field type. Labels and
presentation order may be customizable. There is no field-edit/delete action or
configuration UI in this phase.

### 5. Validation metadata strategy

Nullable `minLength`, `maxLength`, `minValue`, `maxValue`, and `pattern`
properties are stored directly on `CrmFieldDefinition`; `required` is also a
field property. This avoids a separate validation table before there is a
validation engine. These values are metadata only and do not change or replace
the validation in existing Server Actions.

### 6. SELECT option strategy

`CrmFieldOption` stores each key/label, enabled state, and order under a field.
Its composite FK to the field definition enforces CRM/module/field ownership.
The migration copied the current hardcoded Lead status and Task priority/status
choices into rows for the existing CRM (11 option rows); runtime forms remain
unchanged. No option-management UI or renderer was added. New CRM provisioning
does not hardcode or copy another CRM's option lists; these can be configured
when option management is introduced.

### 7. Form model

`CrmForm` is scoped to `(crmInstanceId, moduleKey)`, has a stable key, name,
optional description, and enabled flag. Unique constraints protect form keys
within the CRM/module boundary.

### 8. Form-field relationship

`CrmFormField` links a form and field, with display order and nullable
`requiredOverride` (null means inherit the field definition's required state).
Its two composite foreign keys share `crmInstanceId` and `moduleKey`, so a form
cannot reference a field from another CRM or module.

### 9. Tenant isolation

Field definitions and forms reference
`CrmModuleConfiguration(crmInstanceId, moduleKey)`. Field options reference
`CrmFieldDefinition(crmInstanceId, moduleKey, id)`. Form-field rows reference
both the form and field through their respective CRM/module/id unique keys.
These database constraints enforce ownership independently of client state.

Future field/form Server Actions must derive tenant identity using
`getCrmTenantContext(CRM_PERMISSIONS.FIELDS_...)` or
`getCrmTenantContext(CRM_PERMISSIONS.FORMS_...)`, and then scope every lookup
and mutation to that resolved CRM/module. This phase adds no client-facing
field/form mutation endpoints.

### 10. Permission integration

The existing permission catalog now includes `FIELDS_READ`, `FIELDS_MANAGE`,
`FORMS_READ`, and `FORMS_MANAGE`. CRM owners/admins receive all four; CRM
members receive read-only access to field/form configuration metadata, not
manage access. The new permissions do not grant any operational permission:
each existing record permission remains a separate key. Configuration
permissions are platform-independent and do not map to an operational module
enabled check.

### 11. Migration/backfill

- `20261004200000_add_crm_fields_forms_foundation` creates the field, option,
  form, and form-field metadata tables and composite constraints; seeds current
  CRM module fields, existing form metadata, and current SELECT options.
- `20261004200500_align_field_form_index_names` aligns two PostgreSQL-truncated
  index names with Prisma's expected names.
- Both migrations were applied using `npx prisma migrate deploy`. No migration
  reset was used.
- The schema diff after application reported an empty migration.
- New CRM creation now provisions the 24 system field definitions and eight
  create/edit form definitions plus form-field links inside the existing CRM
  creation transaction (`src/lib/crm/fields.ts` and
  `src/app/(platform)/admin/crm-instances/actions.ts`). Phase 3C extended the
  provisioning helper to seed the corresponding system SELECT options for new
  CRMs, matching the migration's metadata backfill.

### 12. Existing form compatibility

The existing form components, pages, Server Actions, validations, routes, and
dedicated operational models were not changed for dynamic rendering. Existing
operational data counts before and after the metadata backfill were unchanged:
0 Companies, 0 Contacts, 0 Leads, and 0 Tasks in the configured development
database. The migration only inserted configuration metadata.

### 13. Integrity tests

Rollback-only database tests passed:

- Field definitions require an existing module configuration.
- A duplicate field key in the same CRM/module is rejected.
- The same field key in a different CRM/module is accepted.
- A field from CRM A cannot be attached to a CRM B field-option or form-field
  row.
- A form cannot be created under a nonexistent module or connected across
  modules.
- Operational record counts remain unchanged during the tests.

Current configured database metadata counts: one CRM, 24 system fields, zero
custom fields, 11 options, eight forms, and 48 form-field links.

### 14. Validation results

| Check | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — all 12 migrations applied |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Live database-to-schema diff | PASS — empty migration |
| Rollback-only field/form integrity checks | PASS |
| Operational data preservation | PASS |

### 15. Deferred work

- Configuration UI and field builder UI
- Form builder and drag/drop ordering UI
- Runtime dynamic form rendering or operational Server Action changes
- Conditional logic and validation engine
- Arbitrary custom-record storage and custom-field value persistence
- Workflows, dashboard widgets, automation, calculated/file fields, and
  advanced relationship fields
- Configuration history/versioning and system-field mutation policy enforcement

### 16. Recommendations for Phase 3C

Build field and form administration behind the new read/manage permissions.
Derive CRM scope server-side, validate module/field/form composite ownership,
and prohibit destructive or incompatible changes to system-backed definitions.
Keep field option values in the database. Add focused tests for permission
denials and allowed CRUD before exposing administration routes. Do not switch
existing operational forms to metadata-driven rendering until a complete
read/render/validate/write path can preserve current business rules.
