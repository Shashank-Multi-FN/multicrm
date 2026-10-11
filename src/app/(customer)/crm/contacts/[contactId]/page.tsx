import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomFieldValues } from "@/lib/crm/custom-field-values";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import ContactForm from "../contact-form";
import DeleteContactForm from "../delete-contact-form";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.CONTACTS_READ);
  const { contactId } = await params;
  const [contact, companies, customFields, conditionalForm] = await Promise.all([
    db.contact.findFirst({
      where: {
        id: contactId,
        crmInstanceId: tenant.crmId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        status: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.company.findMany({
      where: { crmInstanceId: tenant.crmId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCustomFieldValues({ moduleKey: "contacts", recordId: contactId }),
    getCrmOperationalForm({
      tenant,
      moduleKey: "contacts",
      operation: "edit",
    }),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link className="text-sm text-zinc-500 hover:underline dark:text-zinc-400" href="/crm/contacts">
            ← Back to contacts
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">
            {contact.firstName} {contact.lastName}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Contact details and management
          </p>
        </div>
        <DeleteContactForm contactId={contact.id} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-6">
          <ContactForm
            contact={contact}
            companies={companies}
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
            <dt className="text-zinc-500 dark:text-zinc-400">Company</dt>
            <dd className="mt-1 font-medium">
              {contact.company ? (
                <Link className="hover:underline" href={`/crm/companies/${contact.company.id}`}>
                  {contact.company.name}
                </Link>
              ) : (
                "No company"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd className="mt-1 font-medium">{contact.createdAt.toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Last updated</dt>
            <dd className="mt-1 font-medium">{contact.updatedAt.toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
