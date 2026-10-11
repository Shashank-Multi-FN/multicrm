import {
  CRM_PERMISSIONS,
  roleHasCrmPermission,
} from "@/lib/crm/permissions";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import WorkflowEditor from "./workflow-editor";

export default async function WorkflowConfigurationPage() {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.WORKFLOWS_READ);
  const [moduleConfigurations, workflows] = await Promise.all([
    db.crmModuleConfiguration.findMany({
      where: {
        crmInstanceId: tenant.crmId,
        enabled: true,
        moduleKey: { in: ["companies", "contacts", "leads", "tasks"] },
      },
      orderBy: [{ sortOrder: "asc" }, { moduleKey: "asc" }],
      select: {
        moduleKey: true,
        label: true,
        fieldDefinitions: {
          where: { enabled: true },
          orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
          select: {
            id: true,
            key: true,
            label: true,
            fieldType: true,
            enabled: true,
            options: {
              orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
              select: { key: true, label: true, enabled: true },
            },
          },
        },
      },
    }),
    db.crmWorkflow.findMany({
      where: { crmInstanceId: tenant.crmId },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        moduleKey: true,
        name: true,
        description: true,
        triggerEvent: true,
        enabled: true,
        displayOrder: true,
        conditions: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            fieldId: true,
            operator: true,
            comparisonValue: true,
            enabled: true,
            displayOrder: true,
            field: {
              select: { key: true, label: true, fieldType: true },
            },
          },
        },
        actions: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            actionType: true,
            enabled: true,
            displayOrder: true,
            taskTitle: true,
            taskDescription: true,
            taskStatus: true,
            taskPriority: true,
            taskDueDate: true,
          },
        },
      },
    }),
  ]);

  const canManage = roleHasCrmPermission(
    tenant.crmRole,
    CRM_PERMISSIONS.WORKFLOWS_MANAGE,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Workflow rules</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Configure event triggers and record conditions for {tenant.crmName}.
          Every enabled condition must match before configured Task actions run.
        </p>
      </header>
      <WorkflowEditor
        canManage={canManage}
        modules={moduleConfigurations.map((module) => ({
          moduleKey: module.moduleKey,
          label: module.label,
          fields: module.fieldDefinitions,
        }))}
        workflows={workflows}
      />
    </div>
  );
}
