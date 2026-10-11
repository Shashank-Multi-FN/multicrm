# Phase 2 Report: CRM Roles & Permissions Engine

## Status

**PHASE 2 STATUS: PASS**

The server-side permission catalog, built-in role mapping, authorization helpers,
and permission checks for the existing CRM operations are implemented. Existing
authentication and CRM membership resolution remain in place. No schema,
migration, or configuration UI changes were made for this phase.

## Permission model

Permissions are defined in `src/lib/crm/permissions.ts`. Each permission
identifies a module and operation:

- Dashboard: read
- Companies, contacts, leads, and tasks: read, create, update, delete

Built-in role mapping:

| CRM role | Read | Create | Update | Delete |
|---|---:|---:|---:|---:|
| CRM_OWNER | Yes | Yes | Yes | Yes |
| CRM_ADMIN | Yes | Yes | Yes | Yes |
| CRM_MEMBER | Yes | Yes | Yes | No |

This mapping deliberately reserves destructive record operations for CRM owners
and admins. It is currently static, server-defined policy; administrators cannot
configure it through a UI or database-backed permission matrix.

## Enforcement

`src/lib/crm/context.ts` continues to resolve the authenticated user and
database-backed CRM and organization memberships before returning tenant
context. When a caller requests a permission, the resolved CRM membership role
must grant it. The active-workspace cookie only selects among CRMs returned by
that authorized membership query; it does not grant access.

The following routes enforce module read permissions on their server-rendered
data surfaces:

- Dashboard
- Company list and detail
- Contact list and detail
- Lead list and detail
- Task list and detail

Task creation and editing pages require task create and update permissions.
Company, contact, lead, and task Server Actions independently require the
operation-specific permission before performing create, update, or delete work.
The checks therefore do not depend on client-side state or navigation visibility.

CRM layout and navigation resolution still require authenticated CRM membership,
but navigation visibility remains a presentation concern; it is not a substitute
for the route and action checks. Existing platform administration routes remain
guarded by platform authorization and were not converted to CRM permissions.

## Validation

| Check | Result |
|---|---|
| Permission-map exercise: definitions, owner/admin full access, member non-delete access | PASS (17 permissions) |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — database is up to date |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |

No automated test framework was present for permission scenarios; a focused
runtime exercise of the static permission definitions and role mapping was run.

## Scope and remaining limitations

- Permissions are not yet configurable per CRM and have no configuration UI.
- The catalog covers the existing dashboard and company, contact, lead, and task
  operations only; it does not add new CRM modules or workflows.
- CRM_MEMBER deletion is now denied by server-side policy. Owners and admins
  retain delete access.
- CRM membership administration remains governed by the existing platform
  authorization flow; CRM-level user/role administration is not added here.
- Phase 1's deferred database-level same-CRM composite foreign-key integrity
  remains outside this phase.
- Earlier uncommitted project work was present before this phase. It was
  preserved and not staged, reverted, or otherwise altered as unrelated work.
