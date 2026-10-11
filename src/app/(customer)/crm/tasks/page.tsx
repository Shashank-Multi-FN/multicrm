import Link from "next/link";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import DeleteTaskForm from "./delete-task-form";

function personName(
  person: { firstName: string; lastName: string } | null,
) {
  return person ? `${person.firstName} ${person.lastName}` : "—";
}

export default async function TasksPage() {
  const { crmId } = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_READ);
  const tasks = await db.task.findMany({
    where: { crmInstanceId: crmId },
    include: {
      company: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      lead: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Tasks</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </p>
        </div>
        <Link
          href="/crm/tasks/new"
          className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          New Task
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/10 p-10 text-center dark:border-white/10">
          <h2 className="text-lg font-medium">No tasks yet.</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Create a task to start tracking CRM follow-ups.
          </p>
          <Link
            href="/crm/tasks/new"
            className="mt-5 inline-flex rounded-md border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/10 dark:hover:bg-white/[.06]"
          >
            Create your first task
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-black/10 bg-black/[.02] dark:border-white/10 dark:bg-white/[.03]">
                <tr>
                  {["Title", "Status", "Priority", "Due Date", "Company", "Contact", "Lead", "Actions"].map(
                    (heading) => (
                      <th key={heading} className="px-4 py-3 font-medium">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-black/10 last:border-b-0 dark:border-white/10"
                  >
                    <td className="px-4 py-4 font-medium">{task.title}</td>
                    <td className="px-4 py-4">{task.status ?? "TODO"}</td>
                    <td className="px-4 py-4">{task.priority ?? "—"}</td>
                    <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400">
                      {task.dueDate ? task.dueDate.toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-4">{task.company?.name ?? "—"}</td>
                    <td className="px-4 py-4">{personName(task.contact)}</td>
                    <td className="px-4 py-4">{personName(task.lead)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/crm/tasks/${task.id}`} className="hover:underline">
                          View
                        </Link>
                        <Link href={`/crm/tasks/${task.id}/edit`} className="hover:underline">
                          Edit
                        </Link>
                        <DeleteTaskForm taskId={task.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
