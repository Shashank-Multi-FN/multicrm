export const CRM_MODULE_DEFAULTS = [
  {
    moduleKey: "dashboard",
    label: "Dashboard",
    routePath: "/crm",
    sortOrder: 0,
  },
  {
    moduleKey: "leads",
    label: "Leads",
    routePath: "/crm/leads",
    sortOrder: 1,
  },
  {
    moduleKey: "contacts",
    label: "Contacts",
    routePath: "/crm/contacts",
    sortOrder: 2,
  },
  {
    moduleKey: "companies",
    label: "Companies",
    routePath: "/crm/companies",
    sortOrder: 3,
  },
  {
    moduleKey: "tasks",
    label: "Tasks",
    routePath: "/crm/tasks",
    sortOrder: 4,
  },
] as const;

export function getDefaultCrmModuleConfigurations() {
  return CRM_MODULE_DEFAULTS.map((module) => ({ ...module }));
}

export function getDefaultCrmNavigationItems() {
  return CRM_MODULE_DEFAULTS.map(({ moduleKey, label, sortOrder }) => ({
    moduleKey,
    label,
    sortOrder,
  }));
}
