# GangLion.OS Phase 0 Baseline Report

**Scope:** Read-only foundation baseline; no application code, schema, migrations,
or database contents were changed while preparing this report.

**Repository state:** Branch `master`. The worktree had pre-existing tracked and
untracked changes before this report was created. The report itself is a new
untracked deliverable and is not included in the pre-existing change inventory
below.

## A. Current migrations

Eight migration directories are present, in timestamp order:

1. `20260918070412_init` — creates `User`, `Organization`, `Membership`, and
   `CrmInstance`, plus the original membership-role enum and ownership indexes.
2. `20260922214500_platform_role_foundation` — creates `PlatformRole`, adds
   `User.platformRole`, and narrows `MembershipRole` to organization roles.
3. `20260922230000_auth_session_foundation` — adds `Session`.
4. `20260923173311_add_company_model` — adds `Company`.
5. `20260925133458_add_contact_model` — adds `Contact`.
6. `20260926115416_add_lead_model` — adds `Lead`.
7. `20260927055219_add_task_model` — adds `Task` and its CRM and optional
   company/contact/lead relations.
8. `20261004185000_add_crm_navigation` — adds `CrmModule` and
   `CrmNavigationItem`, indexes and CRM foreign key, and seeds navigation for
   CRM instances that already exist when it runs.

The directories are timestamp-ordered, with no duplicate migration names or
obvious conflicting create operations. The current [schema](./prisma/schema.prisma)
models and fields correspond to the cumulative SQL changes: the original
membership enum is intentionally replaced by the platform-role migration, and
the Task and navigation model changes each have a matching migration file.
No migration was found creating a model or column absent from the final Prisma
schema.

`npx prisma migrate status` connected to the configured local PostgreSQL
database and reported **8 migrations found; only
`20261004185000_add_crm_navigation` is unapplied**. The earlier seven,
including the Task migration, are recorded as applied. This means the database
does not yet match the current schema/code: CRM layouts query
`CrmNavigationItem`, and CRM creation writes it. This is a runtime blocker until
the migration is applied through the normal deployment process.

An automated `prisma migrate diff --from-migrations ... --to-schema ...`
comparison could not run because `prisma.config.ts` has no
`datasource.shadowDatabaseUrl`. No shadow database was configured or modified.
The migration/schema comparison above is based on inspection of the SQL and
Prisma definitions; migration status was separately checked against the
configured database.

## B. Current uncommitted changes

`git status --porcelain=v1` before creating this report showed these changes:

**Tracked modifications:**

- `README.md`
- `prisma/schema.prisma`
- `src/app/(customer)/crm/layout.tsx`
- `src/app/(customer)/crm/tasks/page.tsx`
- `src/app/(platform)/admin/crm-instances/[crmId]/page.tsx`
- `src/app/(platform)/admin/crm-instances/actions.ts`
- `src/app/login/login-form.tsx`
- `src/lib/auth/actions.ts`
- `src/lib/crm/context.ts`

**Untracked additions:**

- `prisma/migrations/20260927055219_add_task_model/migration.sql`
- `prisma/migrations/20261004185000_add_crm_navigation/migration.sql`
- `src/app/(customer)/crm/tasks/[taskId]/edit/page.tsx`
- `src/app/(customer)/crm/tasks/[taskId]/page.tsx`
- `src/app/(customer)/crm/tasks/actions.ts`
- `src/app/(customer)/crm/tasks/delete-task-form.tsx`
- `src/app/(customer)/crm/tasks/new/page.tsx`
- `src/app/(customer)/crm/tasks/task-form.tsx`
- `src/app/(platform)/admin/crm-instances/navigation-actions.ts`
- `src/app/(platform)/admin/crm-instances/navigation-form.tsx`
- `src/app/register/page.tsx`
- `src/app/register/register-form.tsx`
- `src/lib/crm/actions.ts`
- `src/lib/crm/constants.ts`
- `src/lib/crm/navigation.ts`

These changes were not reverted, staged, committed, or otherwise altered. In
particular, the Task migration is present locally and is marked applied in the
configured database, but its migration file is untracked. The navigation
migration is also untracked and is not yet applied in that database.

## C. Current database models

Current Prisma models:

- `User`
- `Organization`
- `Membership`
- `CrmInstance`
- `CrmNavigationItem`
- `Company`
- `Contact`
- `Lead`
- `Task`
- `Session`

Current enums are `MembershipRole`, `PlatformRole`, and `CrmModule`.

The four operational models (`Company`, `Contact`, `Lead`, `Task`) carry a
required `crmInstanceId`. `CrmNavigationItem` is also CRM-scoped. User accounts
are global; their organization access is represented by `Membership`. There
are no Patient, Appointment, Treatment, Invoice, Form, Field, Workflow,
DashboardWidget, Branding, CRM-member, or CRM-permission models in the current
schema.

## D. Current authentication flow

1. Registration validates name, email, password length and confirmation.
2. Passwords are hashed using Argon2id in
   [password.ts](./src/lib/auth/password.ts).
3. Registration transactionally creates a user, organization, owner
   membership, and a default CRM instance in
   [auth/actions.ts](./src/lib/auth/actions.ts).
4. Login normalizes the email, verifies the Argon2id hash, and uses a generic
   invalid-credentials message.
5. Session creation generates a random bearer token, stores its SHA-256 hash
   in `Session`, and sets the raw token in an HttpOnly, SameSite=Lax cookie.
   The cookie is Secure in production. Session duration is 30 days.
6. Session reads validate the token hash and expiration; logout deletes the
   session and cookie. A helper deletes expired sessions, but no scheduler was
   found.

The shared Prisma client in [db.ts](./src/lib/db.ts) constructs
`PrismaClient` with PrismaPg’s PostgreSQL adapter using `DATABASE_URL` from
environment configuration. It fails explicitly if the variable is absent and
uses a `globalThis` singleton outside production to avoid development
hot-reload connection duplication. This matches the installed Prisma 7
configuration and passed the requested build/type checks. No client
initialization defect was found by inspection.

## E. Current CRM authorization flow

- The CRM layout and each CRM data page/action resolve
  `getCrmTenantContext()` on the server from the authenticated user and
  organization memberships; see
  [context.ts](./src/lib/crm/context.ts).
- The active CRM is selected from accessible instances using the HttpOnly
  workspace cookie. A missing or stale selection falls back to the first CRM
  in the user’s accessible instances.
- Workspace switching validates the submitted CRM ID against the user’s
  organization memberships in
  [crm/actions.ts](./src/lib/crm/actions.ts).
- Platform routes are guarded by the platform admin layout, while every
  platform mutation checks `requirePlatformAdmin()` in its Server Action.
- CRM actions do not accept a client-provided CRM ID as their data scope;
  they derive it from the server-side context.

The access grant is **organization membership**, not CRM-specific membership.
A user who belongs to an organization can access every CRM instance owned by
that organization. This does not grant access to CRM instances belonging to
other organizations, but it does not permit independent membership per CRM.
Organization roles are not used as CRM permissions. Platform users only get
CRM access if they also have an applicable organization membership; platform
role alone does not select a CRM.

## F. Current tenant-scoping flow

**CRM pages:** The dashboard resolves context. Company, contact, lead, and
task list/detail pages use the resolved `crmId` in their record queries. Task
create/edit pages also scope the selectable company/contact/lead lists. CRM
navigation reads are scoped to the selected CRM.

**CRM Server Actions:** All current create/update/delete actions in
`companies/actions.ts`, `contacts/actions.ts`, `leads/actions.ts`, and
`tasks/actions.ts` obtain server-side CRM context. Creates write that CRM ID;
updates and deletes first look up or mutate records under that CRM ID.

**Associations:** Contact and lead actions verify an optional company belongs
to the active CRM. Task create/update validates optional company, contact, and
lead IDs against the active CRM before writing. No existing CRM CRUD action was
found that can, through its normal path, read, modify, or delete an operational
record belonging to an inaccessible organization or another selected CRM.
These checks protect the current action paths.

**Database-level limitation:** The SQL foreign keys for contact/lead company
relations and task company/contact/lead relations reference the related
record’s globally unique `id`, not a composite `(crmInstanceId, id)`. The
database therefore does not itself enforce same-CRM ownership across those
relations. A future or alternate write path that omits the current
application-level validation could associate records from different CRM
instances. No current action was found doing so, but tenant integrity depends
on every write path maintaining the checks.

Platform administrators can read/configure organizations and CRM instances
across the platform through platform routes; this is an intentional platform
scope, protected by platform authorization, not a CRM employee data path.

## G. Security-critical findings

1. **Runtime schema mismatch — blocking:** The configured database has not
   applied the navigation migration, but CRM layout queries and CRM creation
   action use `CrmNavigationItem`. Requests that reach those paths can fail
   because the expected table/enum do not yet exist.
2. **Access is broader than per-CRM membership:** Membership in an organization
   gives access to all that organization’s CRM instances. This is current
   behavior, not cross-organization access, but it must be addressed before
   assigning employees to independent CRM workspaces.
3. **Same-CRM relationship integrity is application-enforced only:** Current
   actions validate associated records, but foreign keys do not enforce that
   both records belong to the same CRM.
4. **Navigation visibility is not authorization:** Hiding a configured
   navigation item does not block direct access to its route. No current
   permission-based route denial exists.
5. **Membership-role migration data assumption:** The initial migration
   allowed `PLATFORM_ADMIN` as a membership role; the next migration casts
   existing membership values into an enum that excludes it. If a database
   contains memberships with that old value, that migration can fail. The
   configured local database reports it applied, but production and other
   environments should be checked for this historical value before relying on
   the migration.

No existing CRM Server Action was found to accept an arbitrary client-selected
tenant scope or directly bypass the context checks. No corrective code changes
were made.

## H. Migration risks

- The pending navigation migration is a release/runtime blocker until applied.
- Both current worktree migrations are untracked. A fresh clone or deployment
  built from committed files will omit them unless they are reviewed and
  included in version control.
- The Task migration is already recorded as applied in the checked local
  database, so a deployment that includes the migration must preserve the
  migration history rather than trying to recreate Task.
- The navigation migration seeds existing CRM instances only. Registration
  creates CRM instances directly in its own transaction and does not create
  navigation records. CRM instances registered after the migration can
  therefore have no navigation rows unless that creation flow is made
  consistent.
- The checked migration status is for the configured local PostgreSQL
  database only; it does not establish the migration state of staging or
  production.
- The role-conversion migration can fail on legacy membership rows containing
  `PLATFORM_ADMIN`, as described above.

## I. Files that must not be rewritten unnecessarily

- Authentication/session behavior: [auth/actions.ts](./src/lib/auth/actions.ts),
  [auth/session.ts](./src/lib/auth/session.ts), and
  [auth/password.ts](./src/lib/auth/password.ts).
- Central database client: [db.ts](./src/lib/db.ts).
- Existing tenant context and authorization foundations:
  [crm/context.ts](./src/lib/crm/context.ts) and
  [auth/authorization.ts](./src/lib/auth/authorization.ts).
- Current operational schemas and existing CRUD:
  [schema.prisma](./prisma/schema.prisma) and CRM company/contact/lead/task
  pages and actions under [src/app/(customer)/crm](./src/app/(customer)/crm).
- Platform/CRM route separation and their access-guarding layouts:
  [platform admin](./src/app/(platform)/admin/layout.tsx) and
  [CRM layout](./src/app/(customer)/crm/layout.tsx).

These are stable foundations to extend incrementally; avoid wholesale auth,
database-client, or CRUD rewrites.

## Validation results

| Command | Result |
|---|---|
| `npm run lint` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npx prisma validate` | PASS |
| `git diff --check` | PASS (line-ending warning only for `prisma/schema.prisma`) |
| `npx prisma migrate status` | FAIL / pending migration: `20261004185000_add_crm_navigation` |
| `prisma migrate diff` from migrations to schema | Not completed: requires `datasource.shadowDatabaseUrl`; comparison was inspected manually instead. |

## PHASE 0 STATUS: FAIL

The requested lint, type-check, build, and Prisma schema validation pass. Phase 0
fails the database-baseline gate because the configured database is missing a
migration required by the current runtime code.

### Issues to resolve before Phase 1

1. Review, include in version control, and apply
   `20261004185000_add_crm_navigation` to each target database through the
   deployment migration process; then confirm `prisma migrate status` is
   current. Do not use schema push as a substitute for the migration.
2. Review/include the untracked Task migration and related Task implementation
   so fresh environments can reproduce the schema already present in the
   checked database.
3. Before changing the tenancy model or introducing CRM employee roles, define
   whether and how same-organization users receive access to individual CRM
   instances; preserve/backfill existing organization memberships deliberately.
4. Before adding future record write paths or broadening tenant access, enforce
   same-CRM ownership for relational references at the database boundary, or
   establish an equivalent centrally enforced invariant.
5. Check target databases for legacy `Membership.role = 'PLATFORM_ADMIN'`
   values before attempting to reproduce the role-conversion migration.

## PHASE 0 CLOSURE

### Migration files reviewed

Reviewed both pre-existing untracked migrations against the Prisma schema,
prior migrations, and their application usage:

- `20260927055219_add_task_model/migration.sql` is required by the current
  `Task` model and task pages/actions. It is ordered after the migrations that
  create `Company`, `Contact`, and `Lead`, which are the models referenced by
  its foreign keys. It also references the earlier `CrmInstance` model.
- `20261004185000_add_crm_navigation/migration.sql` is required by the
  `CrmModule` enum and `CrmNavigationItem` model and by CRM layout, platform
  navigation configuration, and CRM creation code. It is after all of its
  dependencies.

The migration history is timestamp-ordered. No migration depends on an object
created only by a later migration. No duplicate/conflicting migration names or
operations were found. The current Prisma schema matches the cumulative final
migration state, including the intentional membership enum transition and
Task/navigation additions.

### Navigation migration safety and application

Before application, the navigation migration SQL was inspected. It creates
`CrmModule`, `CrmNavigationItem`, its indexes and cascading CRM-instance
foreign key, then inserts the default navigation rows for existing CRM
instances. It contains no `DROP`, `TRUNCATE`, or destructive data operation.
The configured development database was confirmed as `multicrm` on
`localhost:5432`.

The normal non-reset workflow `npx prisma migrate deploy` successfully applied
`20261004185000_add_crm_navigation`. The database was not reset, existing data
was not deleted, and `_prisma_migrations` was not manually edited.

### Migration status

- **Before:** 8 migrations found; `20261004185000_add_crm_navigation` was
  pending.
- **After:** `npx prisma migrate status` reports 8 migrations found and
  `Database schema is up to date!`; no pending migrations remain.
- **Schema/database comparison:** `npx prisma migrate diff
  --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
  reports `No difference detected`.
- **Navigation migration applied:** Yes.

### Validation after application

| Command | Result |
|---|---|
| `npx prisma migrate status` | PASS — database schema is up to date |
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Live datasource to Prisma schema diff | PASS — no difference detected |

### Architectural issues intentionally deferred to Phase 1

- Organization membership currently gives access to **all CRM instances
  belonging to that organization**. CRM-level membership and permissions are
  not implemented and were not changed in Phase 0.
- Application actions validate that company/contact/lead/task associations
  belong to the active CRM. Same-CRM composite foreign keys or another
  database-level tenant-integrity design remain deferred to Phase 1.

## FINAL PHASE 0 STATUS: PASS

All requested migration, schema, TypeScript, lint, and build checks pass against
the configured development database. The navigation migration is applied, no
pending migrations remain, and the live database matches the current Prisma
schema.
