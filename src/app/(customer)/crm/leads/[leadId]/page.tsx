import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomFieldValues } from "@/lib/crm/custom-field-values";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { db } from "@/lib/db";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import LeadForm from "../lead-form";
import DeleteLeadForm from "../delete-lead-form";

type LeadPageProps = {
    params: Promise<{
    leadId: string;
    }>;
};

export default async function LeadDetailPage({
    params,
}: LeadPageProps) {
    const { leadId } = await params;
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.LEADS_READ);

    const [lead, companies, customFields, conditionalForm] = await Promise.all([
    db.lead.findFirst({
        where: {
        id: leadId,
        crmInstanceId: tenant.crmId,
        },
    }),
    db.company.findMany({
        where: {
        crmInstanceId: tenant.crmId,
        },
        select: {
        id: true,
        name: true,
        },
        orderBy: {
        name: "asc",
        },
    }),
    getCustomFieldValues({ moduleKey: "leads", recordId: leadId }),
    getCrmOperationalForm({
      tenant,
      moduleKey: "leads",
      operation: "edit",
    }),
    ]);

    if (!lead) {
    notFound();
    }

    return (
    <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <Link
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            href="/crm/leads"
            >
            ← Back to leads
            </Link>

            <h1 className="mt-2 text-3xl font-semibold">
            {lead.firstName} {lead.lastName}
            </h1>

            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Lead details and management
            </p>
        </div>

        <DeleteLeadForm leadId={lead.id} />
        </div>

        <div className="space-y-6">
        <LeadForm
        companies={companies}
        customFields={customFields}
        conditionalForm={conditionalForm}
        lead={{
                id: lead.id,
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.email,
                phone: lead.phone,
                jobTitle: lead.jobTitle,
                source: lead.source,
                status: lead.status,
                companyId: lead.companyId,
        }}
        />

        {customFields.length > 0 ? (
          <section className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
            <h2 className="mb-4 text-lg font-semibold">Custom Fields</h2>
            <dl className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="rounded-lg border border-black/[.08] p-3 dark:border-white/[.145]">
                  <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{field.label}</dt>
                  <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{field.displayValue ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        </div>

        <div className="rounded-xl border border-black/[.08] p-6 dark:border-white/[.145]">
        <h2 className="text-lg font-semibold">Record information</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
            <dt className="text-sm text-zinc-500">Created</dt>
            <dd className="mt-1 text-sm">
                {lead.createdAt.toLocaleString()}
            </dd>
            </div>

            <div>
            <dt className="text-sm text-zinc-500">Last updated</dt>
            <dd className="mt-1 text-sm">
                {lead.updatedAt.toLocaleString()}
            </dd>
            </div>
        </dl>
        </div>
    </div>
    );
}