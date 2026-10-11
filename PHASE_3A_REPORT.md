# Phase 3A Report: Dynamic CRM Module & Navigation Configuration Foundation

## Status

**PHASE 3A STATUS: PASS**

Phase 3A adds per-CRM module configuration records and changes navigation module
identity from a closed Prisma enum to a stable string key. Existing CRM
authentication, membership resolution, role permissions, and CRUD behavior are
preserved. No fields, forms, conditional logic, workflows, dashboards, or new
configuration UI were implemented.

## Data model and migration

`prisma/schema.prisma` now defines:

- `CrmModuleConfiguration`: one CRM-scoped configuration per module key, with
  module label, internal route path, enabled state, and display order.
- `CrmNavigationItem`: CRM-scoped navigation label, visibility, and order,
  related to its module configuration by the composite
  `(crmInstanceId, moduleKey)` key.

The composite relation prevents navigation belonging to one CRM from pointing
at a module configuration belonging to another CRM. Module configuration rows
are themselves foreign-keyed to their owning CRM instance.

Migration
`prisma/migrations/20261004195422_dynamic_crm_module_configuration/migration.sql`
was applied using `npx prisma migrate deploy`; the database was not reset.
It seeds the five existing module definitions for each CRM, converts existing
navigation enum values to lowercase stable keys, preserves existing navigation
labels/visibility/order, and inserts only any missing default navigation rows.
It does not delete CRM or operational data.

Default module keys and routes are defined in
`src/lib/crm/navigation.ts`: `dashboard`, `leads`, `contacts`, `companies`, and
`tasks`. New CRM creation now provisions module configuration and navigation
records together in its existing transaction.

## Runtime integration

- CRM navigation in `src/app/(customer)/crm/layout.tsx` is loaded from the
  selected CRM's database-backed navigation and module configuration. The
  layout resolves database route paths instead of mapping a closed enum to
  hardcoded links.
- The existing platform-side navigation editor now loads each CRM's persisted
  module configurations and updates its associated navigation records. This
  reuses the existing screen; no new configuration interface or module-creation
  controls were added.
- `getCrmTenantContext(permission)` still establishes authenticated CRM
  membership and then checks the existing role permission. It additionally
  denies access when that permission's module is disabled in the selected CRM.
  The same module-enabled check is available through the existing
  `requireCrmPermission` authorization helper.
- Hiding a navigation item remains presentation-only. Disabling a module blocks
  its permission-gated routes and operations; neither behavior replaces the
  existing CRM membership or role checks.

## Data verification

Before migration, the configured development database had one CRM instance and
five navigation rows, with no hidden rows or customized labels. After migration:

- One CRM instance has five module configuration rows and five navigation rows.
- No navigation row lacks its matching module configuration.
- Existing route entries remain under `/crm`.
- A rollback-safe foreign-key probe confirmed that an unconfigured module key
  cannot be attached to a CRM navigation row.
- `npx prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma --script` reported an empty migration (no schema drift).

## Validation

| Check | Result |
|---|---|
| `npx prisma migrate deploy` | PASS — additive migration applied |
| `npx prisma migrate status` | PASS — database schema is up to date |
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Module/navigation row and composite tenant integrity checks | PASS |

An optional migration-directory diff could not run because Prisma requires a
`shadowDatabaseUrl` for that comparison and this repository does not configure
one. The live database-to-schema diff succeeded and was empty.

## Deferred scope

- No UI for adding arbitrary modules or changing module routes/enablement was
  added. The existing navigation editor remains scoped to navigation labels,
  visibility, and order.
- The server-defined permission catalog still covers the existing dashboard,
  companies, contacts, leads, and tasks. This phase does not introduce
  permissions or CRUD implementations for arbitrary new modules.
- Form/field configuration, conditional logic, workflow configuration,
  dashboard configuration, and content/label engines remain deferred.
- Existing prior-phase uncommitted work was preserved; this phase did not stage,
  reset, or revert it.
