import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  AddMemberForm,
  MembershipRow,
} from "../membership-forms";

type OrganizationDetailPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationDetailPage({
  params,
}: OrganizationDetailPageProps) {
  const { organizationId } = await params;
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      name: true,
      slug: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      crmInstances: {
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          slug: true,
          createdAt: true,
        },
      },
    },
  });
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!organization) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link className="text-sm hover:underline" href="/admin/organizations">
          ← Back to organizations
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">{organization.name}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Slug: {organization.slug}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Created {organization.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Members</h2>
        <div className="rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
          <AddMemberForm organizationId={organizationId} users={users} />
        </div>
        {organization.memberships.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            This organization has no members yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-black/[.08] dark:border-white/[.145]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organization.memberships.map((membership) => (
                  <MembershipRow
                    key={`${membership.user.email}-${membership.createdAt.toISOString()}`}
                    membership={{
                      ...membership,
                      createdAt: membership.createdAt.toISOString(),
                    }}
                    organizationId={organizationId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">CRM instances</h2>
        {organization.crmInstances.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            This organization has no CRM instances yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-black/[.08] dark:border-white/[.145]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {organization.crmInstances.map((crmInstance) => (
                  <tr
                    className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]"
                    key={crmInstance.slug}
                  >
                    <td className="px-4 py-3">{crmInstance.name}</td>
                    <td className="px-4 py-3">{crmInstance.slug}</td>
                    <td className="px-4 py-3">
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
