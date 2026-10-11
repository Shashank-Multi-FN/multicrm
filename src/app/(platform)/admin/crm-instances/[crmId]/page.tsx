import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import CrmMembershipForm from "../crm-membership-form";
import CrmNavigationForm from "../navigation-form";

type CrmInstanceDetailPageProps = {
  params: Promise<{ crmId: string }>;
};

export default async function CrmInstanceDetailPage({
  params,
}: CrmInstanceDetailPageProps) {
  const { crmId } = await params;
  const crmInstance = await db.crmInstance.findUnique({
    where: { id: crmId },
    select: {
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      moduleConfigurations: {
        orderBy: [{ sortOrder: "asc" }, { moduleKey: "asc" }],
        select: {
          label: true,
          enabled: true,
          sortOrder: true,
          moduleKey: true,
          routePath: true,
          navigationItem: {
            select: {
              label: true,
              enabled: true,
              sortOrder: true,
            },
          },
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          memberships: {
            orderBy: { createdAt: "asc" },
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  crmMemberships: {
                    where: { crmInstanceId: crmId },
                    select: { role: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!crmInstance) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link className="text-sm hover:underline" href="/admin/crm-instances">
          ← Back to CRM instances
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">{crmInstance.name}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Slug: {crmInstance.slug}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Created {crmInstance.createdAt.toLocaleDateString()}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Updated {crmInstance.updatedAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <section className="max-w-xl space-y-3 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
        <h2 className="text-xl font-semibold">Organization ownership</h2>
        <Link
          className="font-medium hover:underline"
          href={`/admin/organizations/${crmInstance.organization.id}`}
        >
          {crmInstance.organization.name}
        </Link>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization slug: {crmInstance.organization.slug}
        </p>
      </section>

      <CrmMembershipForm
        crmInstanceId={crmId}
        members={crmInstance.organization.memberships.map((membership) => ({
          userId: membership.userId,
          name: membership.user.name,
          email: membership.user.email,
          organizationRole: membership.role,
          crmRole: membership.user.crmMemberships[0]?.role ?? null,
        }))}
      />

      <CrmNavigationForm
        crmInstanceId={crmId}
        modules={crmInstance.moduleConfigurations}
      />
    </div>
  );
}
