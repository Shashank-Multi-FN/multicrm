import { CrmRole } from "@prisma/client/index";

export const CRM_PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",
  COMPANIES_READ: "companies:read",
  COMPANIES_CREATE: "companies:create",
  COMPANIES_UPDATE: "companies:update",
  COMPANIES_DELETE: "companies:delete",
  CONTACTS_READ: "contacts:read",
  CONTACTS_CREATE: "contacts:create",
  CONTACTS_UPDATE: "contacts:update",
  CONTACTS_DELETE: "contacts:delete",
  LEADS_READ: "leads:read",
  LEADS_CREATE: "leads:create",
  LEADS_UPDATE: "leads:update",
  LEADS_DELETE: "leads:delete",
  TASKS_READ: "tasks:read",
  TASKS_CREATE: "tasks:create",
  TASKS_UPDATE: "tasks:update",
  TASKS_DELETE: "tasks:delete",
  FIELDS_READ: "fields:read",
  FIELDS_MANAGE: "fields:manage",
  FORMS_READ: "forms:read",
  FORMS_MANAGE: "forms:manage",
  WORKFLOWS_READ: "workflows:read",
  WORKFLOWS_MANAGE: "workflows:manage",
} as const;

export type CrmPermission =
  (typeof CRM_PERMISSIONS)[keyof typeof CRM_PERMISSIONS];

export const CRM_PERMISSION_DEFINITIONS: Readonly<
  Record<CrmPermission, { module: string | null; operation: string }>
> = {
  [CRM_PERMISSIONS.DASHBOARD_READ]: {
    module: "dashboard",
    operation: "read",
  },
  [CRM_PERMISSIONS.COMPANIES_READ]: {
    module: "companies",
    operation: "read",
  },
  [CRM_PERMISSIONS.COMPANIES_CREATE]: {
    module: "companies",
    operation: "create",
  },
  [CRM_PERMISSIONS.COMPANIES_UPDATE]: {
    module: "companies",
    operation: "update",
  },
  [CRM_PERMISSIONS.COMPANIES_DELETE]: {
    module: "companies",
    operation: "delete",
  },
  [CRM_PERMISSIONS.CONTACTS_READ]: {
    module: "contacts",
    operation: "read",
  },
  [CRM_PERMISSIONS.CONTACTS_CREATE]: {
    module: "contacts",
    operation: "create",
  },
  [CRM_PERMISSIONS.CONTACTS_UPDATE]: {
    module: "contacts",
    operation: "update",
  },
  [CRM_PERMISSIONS.CONTACTS_DELETE]: {
    module: "contacts",
    operation: "delete",
  },
  [CRM_PERMISSIONS.LEADS_READ]: {
    module: "leads",
    operation: "read",
  },
  [CRM_PERMISSIONS.LEADS_CREATE]: {
    module: "leads",
    operation: "create",
  },
  [CRM_PERMISSIONS.LEADS_UPDATE]: {
    module: "leads",
    operation: "update",
  },
  [CRM_PERMISSIONS.LEADS_DELETE]: {
    module: "leads",
    operation: "delete",
  },
  [CRM_PERMISSIONS.TASKS_READ]: {
    module: "tasks",
    operation: "read",
  },
  [CRM_PERMISSIONS.TASKS_CREATE]: {
    module: "tasks",
    operation: "create",
  },
  [CRM_PERMISSIONS.TASKS_UPDATE]: {
    module: "tasks",
    operation: "update",
  },
  [CRM_PERMISSIONS.TASKS_DELETE]: {
    module: "tasks",
    operation: "delete",
  },
  [CRM_PERMISSIONS.FIELDS_READ]: {
    module: null,
    operation: "read",
  },
  [CRM_PERMISSIONS.FIELDS_MANAGE]: {
    module: null,
    operation: "manage",
  },
  [CRM_PERMISSIONS.FORMS_READ]: {
    module: null,
    operation: "read",
  },
  [CRM_PERMISSIONS.FORMS_MANAGE]: {
    module: null,
    operation: "manage",
  },
  [CRM_PERMISSIONS.WORKFLOWS_READ]: {
    module: null,
    operation: "read",
  },
  [CRM_PERMISSIONS.WORKFLOWS_MANAGE]: {
    module: null,
    operation: "manage",
  },
};

const allPermissions = Object.values(CRM_PERMISSIONS);
const nonDestructivePermissions = allPermissions.filter(
  (permission) =>
    !permission.endsWith(":delete") &&
    !permission.endsWith(":manage") &&
    !permission.startsWith("fields:") &&
    !permission.startsWith("forms:"),
);

export const CRM_ROLE_PERMISSIONS: Readonly<
  Record<CrmRole, readonly CrmPermission[]>
> = {
  [CrmRole.CRM_OWNER]: allPermissions,
  [CrmRole.CRM_ADMIN]: allPermissions,
  [CrmRole.CRM_MEMBER]: [
    ...nonDestructivePermissions,
    CRM_PERMISSIONS.FIELDS_READ,
    CRM_PERMISSIONS.FORMS_READ,
    CRM_PERMISSIONS.WORKFLOWS_READ,
  ],
};

export function roleHasCrmPermission(
  role: CrmRole,
  permission: CrmPermission,
): boolean {
  return CRM_ROLE_PERMISSIONS[role].includes(permission);
}
