import Link from "next/link";
import { db } from "@/lib/db";
import { getCustomFieldDefinitionsForModule } from "@/lib/crm/custom-field-values";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import TaskForm from "../task-form";

export default async function NewTaskPage() {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_CREATE);
  const { crmId } = tenant;

  const [companies, contacts, leads, customFields, conditionalForm] = await Promise.all([
    db.company.findMany({
      where: {
        crmInstanceId: crmId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),

    db.contact.findMany({
      where: {
        crmInstanceId: crmId,
      },
      orderBy: {
        lastName: "asc",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    }),

    db.lead.findMany({
      where: {
        crmInstanceId: crmId,
      },
      orderBy: {
        lastName: "asc",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    }),
    getCustomFieldDefinitionsForModule({
      moduleKey: "tasks",
      crmInstanceId: crmId,
    }),
    getCrmOperationalForm({
      tenant,
      moduleKey: "tasks",
      operation: "create",
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/crm/tasks"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to tasks
        </Link>

        <h1 className="mt-2 text-3xl font-semibold">New task</h1>

        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Create a task and optionally associate it with a company, contact,
          or lead.
        </p>
      </div>

      <div className="rounded-xl border border-black/10 p-6 dark:border-white/10">
        <TaskForm
          mode="create"
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