import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomFieldValues } from "@/lib/crm/custom-field-values";
import { getCrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import TaskForm from "../../task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_UPDATE);
  const { crmId } = tenant;
  const [task, companies, contacts, leads, customFields, conditionalForm] = await Promise.all([
    db.task.findFirst({ where: { id: taskId, crmInstanceId: crmId } }),
    db.company.findMany({ where: { crmInstanceId: crmId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.contact.findMany({ where: { crmInstanceId: crmId }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    db.lead.findMany({ where: { crmInstanceId: crmId }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    getCustomFieldValues({ moduleKey: "tasks", recordId: taskId }),
    getCrmOperationalForm({
      tenant,
      moduleKey: "tasks",
      operation: "edit",
    }),
  ]);

  if (!task) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/crm/tasks/${task.id}`} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          ← Back to task
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Edit task</h1>
      </div>
      <div className="rounded-xl border border-black/10 p-6 dark:border-white/10">
        <TaskForm
          mode="edit"
          task={task}
          companies={companies}
          contacts={contacts}
          leads={leads}
          customFields={customFields}
          conditionalForm={conditionalForm}
        />
      </div>
    </div>
  );
}
