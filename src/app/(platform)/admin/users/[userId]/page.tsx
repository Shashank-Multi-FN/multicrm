import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import RoleForm from "../role-form";

type UserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function UserDetailPage({
  params,
}: UserDetailPageProps) {
  const { userId } = await params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          createdAt: true,
          organization: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link className="text-sm hover:underline" href="/admin/users">
          ← Back to users
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">{user.name}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{user.email}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Created {user.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <section className="max-w-md space-y-4 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
        <h2 className="text-xl font-semibold">Platform access</h2>
        <RoleForm userId={user.id} currentRole={user.platformRole} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Organization memberships</h2>
        {user.memberships.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">
            This user has no organization memberships.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-black/[.08] dark:border-white/[.145]">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {user.memberships.map((membership) => (
                  <tr
                    className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]"
                    key={`${membership.organization.name}-${membership.createdAt.toISOString()}`}
                  >
                    <td className="px-4 py-3">{membership.organization.name}</td>
                    <td className="px-4 py-3">{membership.role}</td>
                    <td className="px-4 py-3">
                      {membership.createdAt.toLocaleDateString()}
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
