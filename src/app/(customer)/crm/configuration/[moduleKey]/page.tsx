import Link from "next/link";
import { notFound } from "next/navigation";
import { assertCrmRolePermission } from "@/lib/auth/authorization";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS, roleHasCrmPermission } from "@/lib/crm/permissions";
import { db } from "@/lib/db";
import ConfigurationEditor from "../configuration-editor";

type ModuleConfigurationPageProps = {
  params: Promise<{ moduleKey: string }>;
};

export default async function ModuleConfigurationPage({
  params,
}: ModuleConfigurationPageProps) {
  const { moduleKey } = await params;
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.FIELDS_READ);
  await assertCrmRolePermission(tenant.crmRole, CRM_PERMISSIONS.FORMS_READ);

  const moduleConfiguration = await db.crmModuleConfiguration.findUnique({
    where: {
      crmInstanceId_moduleKey: {
        crmInstanceId: tenant.crmId,
        moduleKey,
      },
    },
    select: {
      moduleKey: true,
      label: true,
      fieldDefinitions: {
        orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
        select: {
          id: true,
          key: true,
          label: true,
          fieldType: true,
          origin: true,
          backingColumn: true,
          required: true,
          enabled: true,
          displayOrder: true,
          minLength: true,
          maxLength: true,
          minValue: true,
          maxValue: true,
          pattern: true,
          options: {
            orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
            select: {
              id: true,
              key: true,
              label: true,
              enabled: true,
              sortOrder: true,
            },
          },
        },
      },
      forms: {
        orderBy: [{ key: "asc" }],
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          enabled: true,
          conditionalRules: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              sourceFieldId: true,
              targetFieldId: true,
              operator: true,
              comparisonValue: true,
              action: true,
              enabled: true,
              sortOrder: true,
              sourceField: {
                select: { id: true, key: true, label: true, fieldType: true },
              },
              targetField: {
                select: { id: true, key: true, label: true, fieldType: true },
              },
            },
          },
          formFields: {
            orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              displayOrder: true,
              requiredOverride: true,
              field: {
                select: {
                  id: true,
                  key: true,
                  label: true,
                  fieldType: true,
                  enabled: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!moduleConfiguration) notFound();

  const canManage =
    roleHasCrmPermission(tenant.crmRole, CRM_PERMISSIONS.FIELDS_MANAGE) &&
    roleHasCrmPermission(tenant.crmRole, CRM_PERMISSIONS.FORMS_MANAGE);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link className="text-sm hover:underline" href="/crm/configuration">
          ← All modules
        </Link>
        <header>
          <h1 className="text-3xl font-semibold">{moduleConfiguration.label} configuration</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            CRM module: {moduleKey}. Configuration changes here do not alter
            runtime validation or existing data-entry forms.
          </p>
        </header>
      </div>
      {!canManage ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          You have read-only access. CRM owners and admins can manage field and
          form configuration.
        </p>
      ) : null}
      <ConfigurationEditor
        canManage={canManage}
        fields={moduleConfiguration.fieldDefinitions}
        forms={moduleConfiguration.forms}
        moduleKey={moduleKey}
        moduleLabel={moduleConfiguration.label}
      />
    </div>
  );
}
