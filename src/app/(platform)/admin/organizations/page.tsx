import Link from "next/link";
import OrganizationForm from "./organization-form";
import { db } from "@/lib/db";

export default async function OrganizationsPage() {
  const organizations = await db.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: {
        select: {
          memberships: true,
          crmInstances: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Organizations</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Manage customer organizations from the platform.
        </p>
      </div>

      <OrganizationForm />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">All organizations</h2>
        {organizations.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            No organizations have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-black/[.08] bg-black/[.02] dark:border-white/[.145] dark:bg-white/[.03]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">CRM instances</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr
                    className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]"
                    key={organization.id}
                  >
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/organizations/${organization.id}`}
                      >
                        {organization.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {organization.slug}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {organization.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{organization._count.memberships}</td>
                    <td className="px-4 py-3">
                      {organization._count.crmInstances}
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
