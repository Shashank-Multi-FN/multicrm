import Link from "next/link";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";

export default async function CrmPage() {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.DASHBOARD_READ);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {tenant.organizationName}
        </p>

        <h1 className="text-3xl font-semibold tracking-tight">
          {tenant.crmName}
        </h1>

        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome, {tenant.userName}.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/crm/companies"
          className="rounded-xl border border-black/[.08] p-5 transition hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Companies
          </p>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-sm text-zinc-500">
            CRM module
          </p>
        </Link>

        <Link
          href="/crm/contacts"
          className="rounded-xl border border-black/[.08] p-5 transition hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Contacts
          </p>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-sm text-zinc-500">
            CRM module
          </p>
        </Link>

        <Link
          href="/crm/leads"
          className="rounded-xl border border-black/[.08] p-5 transition hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Leads
          </p>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-sm text-zinc-500">
            CRM module
          </p>
        </Link>

        <Link
          href="/crm/tasks"
          className="rounded-xl border border-black/[.08] p-5 transition hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tasks
          </p>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="mt-1 text-sm text-zinc-500">
            CRM module
          </p>
        </Link>
      </section>

      <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
        <h2 className="text-lg font-semibold">Workspace</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">
              Organization
            </dt>
            <dd className="mt-1 font-medium">
              {tenant.organizationName}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">
              Organization role
            </dt>
            <dd className="mt-1 font-medium">
              {tenant.organizationRole}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">
              CRM instance
            </dt>
            <dd className="mt-1 font-medium">
              {tenant.crmName}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">
              CRM slug
            </dt>
            <dd className="mt-1 font-medium">
              {tenant.crmSlug}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}