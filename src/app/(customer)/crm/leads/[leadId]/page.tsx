import Link from "next/link";
import { notFound } from "next/navigation";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
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
    const tenant = await getCrmTenantContext();

    const [lead, companies] = await Promise.all([
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

        <LeadForm
        companies={companies}
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