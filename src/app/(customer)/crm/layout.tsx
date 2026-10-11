import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redirectAuthenticatedUser } from "@/lib/auth/actions";
import {
  getCrmTenantContext,
  type CrmTenantContext,
} from "@/lib/crm/context";
import { selectCrmWorkspace } from "@/lib/crm/actions";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS, roleHasCrmPermission } from "@/lib/crm/permissions";

export default async function CrmLayout({
  children,
}: {
  children: ReactNode;
}) {
  let tenant: CrmTenantContext;
  try {
    tenant = await getCrmTenantContext();
  } catch (error) {
    if (!(error instanceof AuthorizationError)) {
      throw error;
    }

    await redirectAuthenticatedUser();
    redirect("/login");
  }

  const navigationItems = await db.crmNavigationItem.findMany({
    where: {
      crmInstanceId: tenant.crmId,
      enabled: true,
      moduleConfiguration: {
        enabled: true,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { moduleKey: "asc" }],
    select: {
      moduleKey: true,
      label: true,
      moduleConfiguration: {
        select: {
          routePath: true,
        },
      },
    },
  });

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/[.08] px-6 py-5 dark:border-white/[.145]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link className="text-xl font-semibold" href="/crm">
            GangLion.OS
          </Link>

          <div className="flex flex-col gap-4 sm:items-end">
            {tenant.availableCrmInstances.length > 1 ? (
              <form action={selectCrmWorkspace} className="flex items-center gap-2">
                <label className="text-sm" htmlFor="crm-workspace">
                  Workspace
                </label>
                <select
                  className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm dark:border-white/20 dark:bg-zinc-950"
                  defaultValue={tenant.crmId}
                  id="crm-workspace"
                  name="crmInstanceId"
                >
                  {tenant.availableCrmInstances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {instance.name} ({instance.slug})
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm dark:border-white/20"
                  type="submit"
                >
                  Switch
                </button>
              </form>
            ) : null}

            <nav
              aria-label="Customer CRM navigation"
              className="flex flex-wrap gap-4 text-sm"
            >
              {navigationItems.map((item) => (
                <Link
                  className="hover:underline"
                  href={item.moduleConfiguration.routePath}
                  key={item.moduleKey}
                >
                  {item.label}
                </Link>
              ))}
              {roleHasCrmPermission(tenant.crmRole, CRM_PERMISSIONS.FIELDS_READ) ? (
                <Link className="hover:underline" href="/crm/configuration">
                  Configuration
                </Link>
              ) : null}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        {children}
      </main>
    </div>
  );
}