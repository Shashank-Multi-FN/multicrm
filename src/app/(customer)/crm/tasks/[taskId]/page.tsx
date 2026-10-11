import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomFieldValues } from "@/lib/crm/custom-field-values";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import DeleteTaskForm from "../delete-task-form";

function personName(
  person: { firstName: string; lastName: string } | null,
) {
  return person ? `${person.firstName} ${person.lastName}` : "—";
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const { crmId } = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_READ);
  const [task, customFields] = await Promise.all([
    db.task.findFirst({
      where: { id: taskId, crmInstanceId: crmId },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        lead: { select: { firstName: true, lastName: true } },
      },
    }),
    getCustomFieldValues({ moduleKey: "tasks", recordId: taskId }),
  ]);

  if (!task) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/crm/tasks" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
            ← Back to Tasks
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">{task.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/crm/tasks/${task.id}/edit`} className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.06]">
            Edit
          </Link>
          <DeleteTaskForm taskId={task.id} />
        </div>
      </div>

      <dl className="grid gap-4 rounded-xl border border-black/10 p-6 sm:grid-cols-2 dark:border-white/10">
        <div><dt className="text-sm text-zinc-500">Description</dt><dd className="mt-1 whitespace-pre-wrap">{task.description ?? "—"}</dd></div>
        <div><dt className="text-sm text-zinc-500">Status</dt><dd className="mt-1">{task.status ?? "TODO"}</dd></div>
        <div><dt className="text-sm text-zinc-500">Priority</dt><dd className="mt-1">{task.priority ?? "—"}</dd></div>
        <div><dt className="text-sm text-zinc-500">Due date</dt><dd className="mt-1">{task.dueDate?.toLocaleString() ?? "—"}</dd></div>
        <div><dt className="text-sm text-zinc-500">Company</dt><dd className="mt-1">{task.company?.name ?? "—"}</dd></div>
        <div><dt className="text-sm text-zinc-500">Contact</dt><dd className="mt-1">{personName(task.contact)}</dd></div>
        <div><dt className="text-sm text-zinc-500">Lead</dt><dd className="mt-1">{personName(task.lead)}</dd></div>
        <div><dt className="text-sm text-zinc-500">Created</dt><dd className="mt-1">{task.createdAt.toLocaleString()}</dd></div>
        <div><dt className="text-sm text-zinc-500">Updated</dt><dd className="mt-1">{task.updatedAt.toLocaleString()}</dd></div>
      </dl>

      {customFields.length > 0 ? (
        <section className="rounded-xl border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 text-lg font-semibold">Custom Fields</h2>
          <dl className="space-y-3">
            {customFields.map((field) => (
              <div key={field.id} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{field.label}</dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{field.displayValue ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
