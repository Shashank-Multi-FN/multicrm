# Phase 3C Report: CRM Field & Form Configuration Administration

## Status

**PHASE 3C STATUS: PASS**

Configuration administration is available inside the authorized CRM workspace.
It manages Phase 3B field/form metadata only; Company, Contact, Lead, and Task
operational forms and Server Actions are unchanged.

## 1. Configuration routes

- `/crm/configuration` lists the module configurations for the server-resolved
  active CRM.
- `/crm/configuration/[moduleKey]` manages field and form metadata for that
  module; lookup is scoped by both the authorized CRM ID and module key.
- A Configuration link is shown in CRM navigation to roles with field-read
  access. CRM members can view metadata but do not receive manage controls.

The requested example `/admin/crm-instances/[crmId]` is inside the existing
platform-admin route group, whose layout requires `PLATFORM_ADMIN`. CRM owners
and admins do not necessarily have that platform role. Granting them entry to
that route group would cross the existing platform/CRM authorization boundary.
The configuration UI is therefore in the CRM workspace, where it can enforce
CRM membership and CRM role permissions without changing platform
authorization. Existing platform-side CRM administration and navigation
management remain unchanged.

## 2. Field administration

The module page displays the stable key, label, type, origin, enabled/required
state, display order, and system backing column. System fields carry a visible
protected marker. Owners/admins can edit the supported metadata; members have a
read-only view.

## 3. Field creation

Owners/admins can create `CUSTOM` fields using the Phase 3B type catalog:
`TEXT`, `TEXTAREA`, `NUMBER`, `EMAIL`, `PHONE`, `DATE`, `DATETIME`, `BOOLEAN`,
and `SELECT`. The UI accepts a stable field key and label, required/enabled
flags, order, and type-appropriate metadata. Key format, label bounds, type,
validation bounds, and duplicate option keys are checked server-side. The
database unique constraint remains authoritative for duplicate field keys.

SELECT creation accepts initial `key|label` option lines; options are persisted
as `CrmFieldOption` rows, not hardcoded UI values.

## 4. Field editing

Field keys and types are immutable in the editor. Server Actions also reject a
submitted attempt to change a key, type, origin, or system backing column.
Labels, enabled/required state, display order, and validation metadata are
editable, with server validation for lengths and numeric ranges.

## 5. System-field protection

System fields are not editable by origin, backing column, key, or type. Required
fields that correspond to non-nullable/required operational inputs remain
required, enforced both by the UI and Server Action. System field deletion is
rejected server-side even if a caller bypasses the UI. No operational database
column can be changed through these actions.

## 6. Field deletion

Only `CUSTOM` definitions can be deleted. The action re-queries the field with
the authenticated CRM and requested module before deletion. Database cascades
remove its option and form-field metadata references. Deletion is
metadata-only; custom-field value persistence does not exist in this phase.
The UI asks for confirmation before deletion.

## 7. Validation metadata configuration

Configuration controls store required state, minimum/maximum text length,
minimum/maximum numeric value, and pattern metadata. The UI explicitly states
that this does not activate runtime validation. The existing operational
Server Action validation remains unchanged.

## 8. SELECT option management

Each SELECT field displays its stored options. Authorized managers can add an
option, change its label, enabled state and order, or delete it. Option keys
are displayed as stable identifiers and are not editable; the Server Action
rejects attempted key changes. Options are scoped to the authorized CRM,
module, and field. Destructive option deletion has a confirmation prompt.

## 9. Form administration

The module page lists each form's name, stable key, enabled state, module and
field count. Owners/admins can create forms, edit name/description, and
enable/disable them. Existing create/edit form metadata is included. No
operational form is rendered from this configuration.

## 10. Form-field management

Managers can attach enabled fields from the same CRM/module to enabled forms,
set display order and choose a required override (inherit, required, optional),
edit those settings, or remove the field from the form. The Server Action
validates form and field ownership and enabled state before insertion; the
existing composite foreign keys remain the final integrity boundary.

## 11. Permission enforcement

The UI uses `FIELDS_READ` and `FORMS_READ`; mutation actions independently
resolve tenant context with `FIELDS_MANAGE` or `FORMS_MANAGE`. Existing role
mapping permits owners/admins to manage configuration and permits members to
read only. These checks remain separate from operational record permissions.
Configuration access does not grant Company/Contact/Lead/Task create, update,
or delete permission.

## 12. Tenant isolation

No action trusts a client-supplied `crmInstanceId`. CRM identity is resolved
from authenticated user, organization membership, CRM membership, and selected
workspace by `getCrmTenantContext`. Module keys are checked against module
configuration belonging to that CRM. Every field, option, form, and form-field
lookup or mutation is additionally scoped by the resolved CRM and module. The
database composite FKs continue to reject cross-CRM and cross-module links.

## 13. Security tests

Focused action tests using controlled mocked contexts passed:

- CRM_OWNER and CRM_ADMIN manage field metadata.
- CRM_MEMBER is denied field/form management.
- Forged attempts to change system field key, origin, type, or backing column
  are rejected without a write.
- System field deletion is rejected.
- A field ID from another CRM is not found under the selected CRM and causes no
  write.
- A field from another CRM cannot be attached to the selected CRM's form.

Database constraints and rollback-only tests from Phase 3B continue to provide
duplicate-key and composite ownership enforcement. No test fixtures or
operational records were persisted for this phase.

## 14. Validation results

| Check | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — all 12 migrations applied |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — includes `/crm/configuration` routes |
| Configuration permission and mutation-security tests | PASS |
| `git diff --check` | PASS |

No schema changes or migrations were needed for Phase 3C.

## 15. Deferred work

- Dynamic runtime form rendering or operational record form replacement
- Custom-field value persistence and dynamic record CRUD
- Runtime validation engine or conditional logic
- Workflows, dashboards/widgets, and automation
- Drag-and-drop ordering, file/calculated/relationship fields
- Configuration audit history/versioning
- Platform-wide configuration management overrides

## 16. Recommendations for Phase 3D

Before using configured forms to write operational data, design a complete
server-side metadata-driven validation and persistence path. Preserve the
dedicated Company/Contact/Lead/Task models and their existing business rules;
do not treat the metadata fields as persisted record values. Add authorization
and tenant-isolation tests for each new form/field action, and define an
explicit migration/rollback strategy for any future custom-value storage.
