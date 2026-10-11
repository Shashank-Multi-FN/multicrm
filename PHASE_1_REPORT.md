# GangLion.OS Phase 1 Report — CRM Membership Boundary

**Scope:** CRM-instance membership, authorization, provisioning, and access
preservation. Authentication implementation, UI design, CRM modules, and
configuration engines were not rewritten or introduced.

## 1. Existing access architecture

Before this change, `Membership` connected users to organizations, and
`getCrmTenantContext()` selected any CRM under an organization where that user
had a membership. The active workspace cookie selected among those instances;
it did not represent a CRM-specific grant. Operational records already carried
`crmInstanceId`, and current CRM pages/actions filtered records using that
server-resolved ID.

Platform administration used a separate `PlatformRole` and
`requirePlatformAdmin()` check.

## 2. Target access architecture

CRM operational access now requires both:

1. Organization membership in the CRM instance's owning organization.
2. An explicit `CrmMembership` for that specific instance.

The active CRM cookie only selects among CRM instances for which both database
memberships exist. Changing the cookie does not grant access. Platform admin
authorization remains separate and does not silently grant operational CRM
membership.

## 3. Prisma schema changes

Added `CrmRole` (`CRM_OWNER`, `CRM_ADMIN`, `CRM_MEMBER`) and
`CrmMembership` with user/CRM foreign keys, role, timestamps, unique
`(userId, crmInstanceId)`, and indexes on each lookup column. Added inverse
relations to `User` and `CrmInstance`.

Migration: [20261004190000_add_crm_memberships](./prisma/migrations/20261004190000_add_crm_memberships/migration.sql).

## 4. CRM membership model and roles

- `CRM_OWNER` maps legacy `ORG_OWNER`.
- `CRM_ADMIN` maps legacy `ORG_ADMIN`.
- `CRM_MEMBER` maps legacy `ORG_MEMBER`.
- Membership is unique per user and CRM.
- Existing CRM operational capabilities remain available to CRM members;
  role-specific operational permission differences are not introduced here.
- Platform admins can assign, change, or remove CRM membership from the CRM
  instance detail screen. Assignment is only permitted to a user who belongs
  to that CRM's owning organization.

## 5. Authorization helpers

Added `requireCrmMembership(crmId)`, `requireCrmRole(crmId, roles)`, and
`hasCrmPermission(crmId, permission)` in
[authorization.ts](./src/lib/auth/authorization.ts). The CRM membership check
also verifies organization membership for the CRM's owning organization.
Existing `requireCrmAccess(organizationId, crmId)` now requires both
organization and CRM membership.

The initial permission mapping preserves current operations: all CRM roles can
read/write; only CRM owner/admin roles have `CRM_MANAGE`. Existing CRUD actions
continue to require the central server-resolved CRM context. No broad
permission matrix was added.

## 6. CRM tenant resolution

[context.ts](./src/lib/crm/context.ts) now lists only CRM instances where the
current user has a CRM membership and a membership in the owning organization.
It chooses the cookie-selected CRM only from that authorized list and falls
back to the first authorized CRM if the cookie is missing/stale/unauthorized.
The resulting context includes CRM role and organization role.

[crm/actions.ts](./src/lib/crm/actions.ts) applies the same two-membership
check when setting the active CRM cookie. The cookie remains a UX selector,
not an authorization source.

Routes remain under `/crm` as requested; no route migration was performed.

## 7. Existing modules protected

Source inspection confirmed each current CRM page resolves
`getCrmTenantContext()` before data access:

- Dashboard
- Companies list and detail
- Contacts list and detail
- Leads list and detail
- Tasks list, create page, detail, and edit page

All Company, Contact, Lead, and Task create/update/delete Server Actions also
resolve that context. Detail reads and mutations are scoped by the resolved
`crmInstanceId`; task association options are scoped to the same instance.
CRM layout navigation is selected by the authorized instance, but navigation
visibility is not used as authorization.

## 8. Cross-CRM association protection

Application validation remains in place:

- Contact and Lead writes verify the selected Company belongs to the active
  CRM.
- Task create/update validates Company, Contact, and Lead IDs against the
  active CRM.
- Record detail and update/delete paths first verify the record belongs to the
  active CRM; updates/deletes use the tenant ID in their mutation filters
  wherever the action already used scoped bulk mutation.

No current CRM action was found to read, modify, or delete another CRM's
operational records through its normal server-side path.

The database foreign keys still do not enforce same-CRM ownership across
Company/Contact/Lead/Task relationships. This remains a Phase 1B item.

## 9. Existing-data backfill

The migration deterministically creates one CRM membership for every existing
organization membership × CRM owned by that organization. It maps the existing
organization role to the equivalent CRM role. This preserves all existing
effective access; it does not silently remove CRM access.

Before migration, the configured development database contained 1 organization,
1 organization membership, and 1 CRM instance, for 1 expected backfill row.
After migration, it contains 1 CRM membership: 1 owner, 0 admins, and 0
members. No organization or operational record was deleted or modified by the
backfill.

## 10. CRM provisioning

Both existing CRM creation paths were inspected:

- Public registration creates the organization owner, CRM instance, and
  `CRM_OWNER` membership for the creator in the same transaction in
  [auth/actions.ts](./src/lib/auth/actions.ts).
- Platform CRM creation provisions existing organization owners/admins to the
  new instance as CRM owners/admins in the same transaction in
  [crm-instances/actions.ts](<./src/app/(platform)/admin/crm-instances/actions.ts>).
  The action refuses to create a CRM if the organization has no owner/admin
  membership; ordinary organization members are not automatically granted
  access to a newly-created CRM.

New organization members are not automatically added to every CRM. A platform
admin can explicitly grant the user the required CRM role on the instance
detail page. Removing an organization membership also removes that user's CRM
memberships in the organization, preventing stale grants from becoming active
if organization membership is later restored.

## 11. Platform-admin compatibility

The `PLATFORM_ADMIN` role and `requirePlatformAdmin()` checks were not replaced.
Platform routes for CRM instance management and navigation remain protected by
platform authorization. Platform administrators can manage CRM membership
without being granted CRM operational access. CRM operational actions require
CRM membership, including for platform administrators.

## 12. URL architecture recommendation

Canonical future route target:

- `/crm/[crmSlug]`
- `/crm/[crmSlug]/companies`
- `/crm/[crmSlug]/contacts`
- `/crm/[crmSlug]/leads`
- `/crm/[crmSlug]/tasks`

Routes are intentionally still `/crm` in this phase. Any future slug-based
route must resolve the slug on the server and call CRM membership
authorization; a URL, hidden form value, or cookie alone cannot authorize the
target.

## 13. Security scenarios checked

No test framework exists in the project, so no large framework was added.
Ran a rollback-only PostgreSQL fixture transaction with two CRM instances in
the same organization, membership in CRM A only, and Company/Contact/Lead/Task
records in CRM B:

- **A. Assigned CRM access:** CRM A appeared in the authorized CRM query.
- **B. Unassigned CRM in same organization:** CRM B did not appear and had no
  CRM membership.
- **C. Direct target access:** CRM B's membership-scoped authorization lookup
  returned no grant. Current URLs are not CRM-specific yet; future URL routes
  must use the same server-side check.
- **D. Manually changed CRM cookie:** Source inspection confirmed the context
  selects only from CRM memberships joined with organization memberships, so
  an unauthorized cookie value cannot add CRM B to the authorized set.
- **E. Foreign Company access:** lookup constrained by CRM A did not return a
  Company from CRM B.
- **F. Foreign Task update:** update constrained by CRM A affected zero rows
  for a Task in CRM B.
- **G. Cross-CRM association:** scoped Company/Contact/Lead lookups for CRM A
  rejected records in CRM B; current server-action validation uses these
  same-CRM predicates. Task row from CRM B was likewise not visible in CRM A.
- **H. Platform management:** platform route/action guards still use
  `requirePlatformAdmin()`; CRM operational access does not bypass
  `CrmMembership`.

The fixture transaction was rolled back, leaving no test rows in the database.

## 14. Migration safety and status

The migration adds one enum, one membership table, indexes, unique constraint,
foreign keys, and deterministic membership inserts. It contains no `DROP`,
`TRUNCATE`, or update/delete of existing CRM data. The live database had one
expected backfill row before application.

Applied with `npx prisma migrate deploy`; no database reset or manual
`_prisma_migrations` edits were performed. Final `npx prisma migrate status`
reports 9 migrations found and `Database schema is up to date!`.

## 15. Validation

| Command | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — no pending migrations |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Live datasource to Prisma schema diff | PASS — no difference detected |
| Rollback-only tenant-isolation fixture | PASS |

## 16. Remaining limitations

- Organization membership currently remains a prerequisite for CRM membership.
  Users with CRM membership but no owning-organization membership are denied.
- Existing users retain access to all their organization's existing CRM
  instances until an administrator explicitly changes those CRM memberships.
- CRM owner/admin/member roles currently preserve the same operational
  read/write access. A full granular permission matrix is not implemented.
- CRM membership administration is currently available to platform admins
  only; organization-owner/admin self-service member management is not added.
- Routes remain cookie-selected under `/crm`, not independently addressable by
  slug.
- Hiding a navigation item still only changes the UI; CRM membership protects
  the whole CRM scope, not module-level routes.
- Relational foreign keys do not yet enforce same-CRM parent/child integrity.
- The earlier navigation migration's registration-time default-navigation
  seeding gap remains outside this phase.
- The project still has pre-existing uncommitted changes, including the Task
  and navigation migrations. They were preserved and not staged or committed.

## 17. Phase 1B recommendations

1. Assess existing cross-CRM relationships and add same-CRM database
   constraints only with an explicit, non-destructive repair/backfill plan.
2. Define granular permissions and ownership/admin responsibilities before
   differentiating CRM role capabilities.
3. Migrate from cookie-selected `/crm` to slug-addressable routes with
   server-side membership enforcement and regression coverage.
4. Consider organization-owner/admin CRM membership management without
   implicitly granting access to every CRM.
5. Align registration and all future CRM provisioning paths to create
   navigation defaults consistently.

## PHASE 1 STATUS: PASS

The CRM membership/access boundary is enforced for current CRM operations,
legacy access was preserved by deterministic backfill, provisioning paths
assign explicit membership, migration status is clean, and requested
validation passes. Deferred items above are architectural follow-ups, not
organization-wide authorization bypasses.
