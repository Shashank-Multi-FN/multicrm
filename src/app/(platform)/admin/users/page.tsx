import Link from "next/link";
import { db } from "@/lib/db";
import UserForm from "./user-form";

export default async function UsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      platformRole: true,
      createdAt: true,
      _count: {
        select: { memberships: true },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Users</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Manage platform users and their access.
        </p>
      </div>
      <UserForm />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">All users</h2>
        {users.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">No users found.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/[.08] dark:border-white/[.145]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-black/[.08] bg-black/[.02] dark:border-white/[.145] dark:bg-white/[.03]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Platform role</th>
                  <th className="px-4 py-3 font-medium">Organizations</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]"
                    key={user.id}
                  >
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/users/${user.id}`}
                      >
                        {user.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.platformRole}</td>
                    <td className="px-4 py-3">{user._count.memberships}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {user.createdAt.toLocaleDateString()}
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
