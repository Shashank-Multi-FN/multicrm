import Form from "next/form";
import Link from "next/link";
import {
  getCustomFieldDefinitionsForModule,
} from "@/lib/crm/custom-field-values";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import ContactForm from "./contact-form";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.CONTACTS_READ);
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();
  const [contacts, companies, customFields, conditionalForm] = await Promise.all([
    db.contact.findMany({
      where: {
        crmInstanceId: tenant.crmId,
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(status ? { status: { equals: status, mode: "insensitive" } } : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        status: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
      },
    }),
    db.company.findMany({
      where: { crmInstanceId: tenant.crmId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCustomFieldDefinitionsForModule({
      moduleKey: "contacts",
      crmInstanceId: tenant.crmId,
    }),
    getCrmOperationalForm({
      tenant,
      moduleKey: "contacts",
      operation: "create",
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{tenant.crmName}</p>
          <h1 className="text-3xl font-semibold">Contacts</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage people in this CRM instance.
          </p>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
        </p>
      </section>

      <Form action="/crm/contacts" className="flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
          defaultValue={query}
          name="q"
          placeholder="Search by name, email, or phone"
          type="search"
        />
        <input
          className="rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950"
          defaultValue={status}
          name="status"
          placeholder="Filter by status"
          type="text"
        />
        <button
          className="rounded-lg border border-black/15 px-4 py-2 font-medium dark:border-white/20"
          type="submit"
        >
          Filter
        </button>
      </Form>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="space-y-3">
          {contacts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-6 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
              No contacts match the current filters.
            </div>
          ) : (
            contacts.map((contact) => (
              <Link
                className="block rounded-xl border border-black/[.08] p-5 transition hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
                href={`/crm/contacts/${contact.id}`}
                key={contact.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">
                      {contact.firstName} {contact.lastName}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {contact.email ?? contact.phone ?? "No contact details"}
                    </p>
                  </div>
                  {contact.status ? (
                    <span className="rounded-full bg-black/[.06] px-2.5 py-1 text-xs dark:bg-white/[.1]">
                      {contact.status}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {contact.company ? <span>{contact.company.name}</span> : null}
                  {contact.jobTitle ? <span>{contact.jobTitle}</span> : null}
                  <span>Created {contact.createdAt.toLocaleDateString()}</span>
                </div>
              </Link>
            ))
          )}
        </section>

        <ContactForm
          companies={companies}
          conditionalForm={conditionalForm}
          customFields={customFields}
        />
      </div>
    </div>
  );
}
