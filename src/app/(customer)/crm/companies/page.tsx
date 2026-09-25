import Link from "next/link";
import Form from "next/form";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import CompanyForm from "./company-form";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const tenant = await getCrmTenantContext();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();
  const companies = await db.company.findMany({
    where: {
      crmInstanceId: tenant.crmId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(status ? { status: { equals: status, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      industry: true,
      status: true,
    },
  });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{tenant.crmName}</p>
          <h1 className="text-3xl font-semibold">Companies</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Manage companies in this CRM instance.
          </p>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {companies.length} {companies.length === 1 ? "company" : "companies"}
        </p>
      </section>

      <Form action="/crm/companies" className="flex flex-col gap-3 sm:flex-row">
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
          {companies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 p-6 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
              No companies match the current filters.
            </div>
          ) : (
            companies.map((company) => (
              <Link
                className="block rounded-xl border border-black/[.08] p-5 transition hover:bg-black/[.03] dark:border-white/[.145] dark:hover:bg-white/[.04]"
                href={`/crm/companies/${company.id}`}
                key={company.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{company.name}</h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {company.email ?? company.phone ?? "No contact details"}
                    </p>
                  </div>
                  {company.status ? (
                    <span className="rounded-full bg-black/[.06] px-2.5 py-1 text-xs dark:bg-white/[.1]">
                      {company.status}
                    </span>
                  ) : null}
                </div>
                {company.industry ? (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {company.industry}
                  </p>
                ) : null}
              </Link>
            ))
          )}
        </section>

        <CompanyForm />
      </div>
    </div>
  );
}
