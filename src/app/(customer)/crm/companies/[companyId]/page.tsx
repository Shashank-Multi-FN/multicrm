import Link from "next/link";
import { notFound } from "next/navigation";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import CompanyForm from "../company-form";
import DeleteCompanyForm from "../delete-company-form";
import { getCustomFieldValues } from "@/lib/crm/custom-field-values";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.COMPANIES_READ);
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

  const [customFields, conditionalForm] = await Promise.all([
    getCustomFieldValues({
      moduleKey: "companies",
      recordId: company.id,
    }),
    getCrmOperationalForm({
      tenant,
      moduleKey: "companies",
      operation: "edit",
    }),
  ]);

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
        <div className="space-y-6">
          <CompanyForm
            company={company}
            conditionalForm={conditionalForm}
            customFields={customFields}
          />

          {customFields.length > 0 ? (
            <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
              <h2 className="mb-4 text-lg font-semibold">Custom Fields</h2>
              <dl className="space-y-3">
                {customFields.map((field) => (
                  <div key={field.id} className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]">
                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{field.label}</dt>
                    <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                      {field.displayValue ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

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
