import Link from "next/link";
import { assertCrmRolePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";

export default async function CrmConfigurationPage() {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.FIELDS_READ);
  await assertCrmRolePermission(tenant.crmRole, CRM_PERMISSIONS.FORMS_READ);
  const modules = await db.crmModuleConfiguration.findMany({
    where: { crmInstanceId: tenant.crmId },
    orderBy: [{ sortOrder: "asc" }, { moduleKey: "asc" }],
    select: {
      moduleKey: true,
      label: true,
      enabled: true,
      _count: {
        select: {
          fieldDefinitions: true,
          forms: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">CRM configuration</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Configure field and form metadata for {tenant.crmName}. Existing CRM
          record-entry forms continue to work independently.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Modules</h2>
        {modules.map((module) => (
          <Link
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[.08] p-5 hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
            href={`/crm/configuration/${module.moduleKey}`}
            key={module.moduleKey}
          >
            <span>
              <span className="block font-semibold">{module.label}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {module.moduleKey} · {module.enabled ? "Enabled" : "Disabled"}
              </span>
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {module._count.fieldDefinitions} fields · {module._count.forms} forms
            </span>
          </Link>
        ))}
      </section>
      <section className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
        <h2 className="text-xl font-semibold">Workflow rules</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Configure record-created, record-updated, and record-deleted match
          decisions without executing actions.
        </p>
        <Link
          className="mt-3 inline-flex rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/[.03] dark:border-white/20 dark:hover:bg-white/[.04]"
          href="/crm/configuration/workflows"
        >
          Manage workflow rules
        </Link>
      </section>
    </div>
  );
}
