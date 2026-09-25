import Link from "next/link";
import { notFound } from "next/navigation";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import CompanyForm from "../company-form";
import DeleteCompanyForm from "../delete-company-form";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const tenant = await getCrmTenantContext();
  const { companyId } = await params;
  const company = await db.company.findFirst({
    where: {
      id: companyId,
      crmInstanceId: tenant.crmId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      website: true,
      industry: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm text-zinc-500 hover:underline dark:text-zinc-400" href="/crm/companies">
            ← Back to companies
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">{company.name}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Company details and management
          </p>
        </div>
        <DeleteCompanyForm companyId={company.id} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <CompanyForm company={company} />

        <dl className="h-fit space-y-4 rounded-xl border border-black/[.08] p-6 text-sm dark:border-white/[.145]">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">CRM instance</dt>
            <dd className="mt-1 font-medium">{tenant.crmName}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd className="mt-1 font-medium">{company.createdAt.toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Contacts</dt>
            <dd className="mt-1 font-medium">{company._count.contacts}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Last updated</dt>
            <dd className="mt-1 font-medium">{company.updatedAt.toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
