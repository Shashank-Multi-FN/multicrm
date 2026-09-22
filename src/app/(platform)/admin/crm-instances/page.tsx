import Link from "next/link";
import { db } from "@/lib/db";
import CrmInstanceForm from "./crm-instance-form";

export default async function CrmInstancesPage() {
  const [crmInstances, organizations] = await Promise.all([
    db.crmInstance.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
    db.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">CRM Instances</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Manage CRM environments and their organization ownership.
        </p>
      </div>

      <CrmInstanceForm organizations={organizations} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">All CRM instances</h2>
        {crmInstances.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            No CRM instances have been created yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-black/[.08] bg-black/[.02] dark:border-white/[.145] dark:bg-white/[.03]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {crmInstances.map((crmInstance) => (
                  <tr
                    className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]"
                    key={crmInstance.id}
                  >
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/crm-instances/${crmInstance.id}`}
                      >
                        {crmInstance.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{crmInstance.slug}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="hover:underline"
                        href={`/admin/organizations/${crmInstance.organization.id}`}
                      >
                        {crmInstance.organization.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {crmInstance.createdAt.toLocaleDateString()}
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
