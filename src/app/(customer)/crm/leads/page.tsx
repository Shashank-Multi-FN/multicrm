import Link from "next/link";

import { db } from "@/lib/db";
import { getCrmTenantContext } from "@/lib/crm/context";

import LeadForm from "./lead-form";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { crmId } = await getCrmTenantContext();
  const params = await searchParams;

  const query = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";

  const leads = await db.lead.findMany({
    where: {
      crmInstanceId: crmId,
      ...(query
        ? {
            OR: [
              {
                firstName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      ...(status
        ? {
            status,
          }
        : {}),
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const companies = await db.company.findMany({
    where: {
      crmInstanceId: crmId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Leads</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage prospects and track their sales status.
        </p>
      </div>

      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Create lead</h2>

        <LeadForm companies={companies} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">All leads</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {leads.length} lead{leads.length === 1 ? "" : "s"} found.
            </p>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search leads..."
              className="rounded-md border px-3 py-2 text-sm"
            />

            <select
              name="status"
              defaultValue={status}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>

            <button
              type="submit"
              className="rounded-md border px-4 py-2 text-sm font-medium"
            >
              Filter
            </button>
          </form>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No leads found.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Create a lead or change your search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/crm/leads/${lead.id}`}
                        className="font-medium hover:underline"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                      {lead.jobTitle && (
                        <div className="text-xs text-zinc-500">
                          {lead.jobTitle}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.company ? (
                        <Link
                          href={`/crm/companies/${lead.company.id}`}
                          className="hover:underline"
                        >
                          {lead.company.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.email || (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.phone || (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.source || (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {lead.status || (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}