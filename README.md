# GangLion.OS

GangLion.OS is a multi-tenant platform for managing independent CRM instances.
Platform administration and CRM operations use separate route groups and
layouts: `/admin` is platform scope, while `/crm` is CRM scope.

## Current architecture

- Platform routes manage organizations, platform users, and CRM instances.
- An organization can own multiple CRM instances. CRM users can switch between
  the instances available through their organization memberships.
- CRM operational records are associated with a `CrmInstance` and CRM queries
  are scoped to the active instance.
- CRM navigation labels, visibility, and ordering are stored per instance.
  Platform administrators configure these settings from an instance's detail
  page. Navigation destinations are restricted to implemented modules.
- Platform administrator access is checked on the server and remains separate
  from CRM organization membership.

The current CRM includes dashboard, leads, contacts, companies, and tasks.
CRM-specific roles and permissions, configurable modules and forms, dashboard
widgets, workflows, branding, and content labels beyond navigation are not yet
implemented. Organization membership currently grants CRM access; a separate
CRM-level role and permission engine remains a future migration step.

## Development

Install dependencies and configure the PostgreSQL connection using the
repository's Prisma configuration. Apply pending migrations before starting
the application:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Run `npm run lint` to check the application.
