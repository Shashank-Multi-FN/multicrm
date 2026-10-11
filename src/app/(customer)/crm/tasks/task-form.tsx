"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { CrmFieldType } from "@prisma/client/index";
import { createTask, updateTask } from "./actions";
import type { CustomFieldDisplayValue } from "@/lib/crm/custom-field-values";
import type { ConditionalFieldState } from "@/lib/crm/conditional-logic";
import type { RuntimeForm } from "@/lib/crm/runtime-forms";
import { useOperationalConditionalFields } from "@/lib/crm/use-operational-conditional-fields";

type TaskFormState = {
  error?: string;
  customFieldErrors?: Record<string, string>;
};

type TaskFormProps = {
  mode: "create" | "edit";
  task?: {
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    priority: string | null;
    status: string | null;
    companyId: string | null;
    contactId: string | null;
    leadId: string | null;
  };
  companies?: {
    id: string;
    name: string;
  }[];
  contacts?: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  leads?: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  customFields?: CustomFieldDisplayValue[];
  conditionalForm?: RuntimeForm | null;
};

function TaskCustomFieldControl({
  field,
  error,
  state,
}: {
  field: CustomFieldDisplayValue;
  error?: string;
  state: ConditionalFieldState;
}) {
  const name = `field:${field.key}`;
  const baseClass =
    "w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black";

  switch (field.fieldType) {
    case CrmFieldType.SELECT:
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            {field.label}
            {state.required ? <span className="ml-1 text-red-600">*</span> : null}
          </label>
          <select className={baseClass} defaultValue={field.optionKey ?? ""} disabled={!state.enabled || !state.visible} name={name} required={state.required}>
            <option value="">Select an option</option>
            {field.options.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.BOOLEAN:
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input defaultChecked={Boolean(field.value)} className="size-4 rounded border-black/20" disabled={!state.enabled || !state.visible} name={name} required={state.required} type="checkbox" value="true" />
            <span>{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</span>
          </label>
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.DATE:
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "string" ? field.value : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} type="date" />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.DATETIME:
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "string" ? field.value.slice(0, 16) : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} type="datetime-local" />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    case CrmFieldType.NUMBER:
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "number" ? String(field.value) : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} step="any" type="number" />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
    default:
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">{field.label}{state.required ? <span className="ml-1 text-red-600">*</span> : null}</label>
          <input className={baseClass} defaultValue={typeof field.value === "string" ? field.value : ""} disabled={!state.enabled || !state.visible} name={name} required={state.required} type={field.fieldType === CrmFieldType.EMAIL ? "email" : field.fieldType === CrmFieldType.PHONE ? "tel" : "text"} />
          {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>
      );
  }
}

export default function TaskForm({
  mode,
  task,
  companies = [],
  contacts = [],
  leads = [],
  customFields = [],
  conditionalForm,
}: TaskFormProps) {
  const router = useRouter();
  const action =
    mode === "create"
      ? async (_state: TaskFormState, formData: FormData) => {
          try {
            const customFields: Record<string, string> = {};
            for (const [name, value] of formData.entries()) {
              if (typeof name === "string" && name.startsWith("field:")) {
                customFields[name.slice("field:".length)] = String(value);
              }
            }

            const taskId = await createTask({
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              dueDate: String(formData.get("dueDate") ?? ""),
              priority: String(formData.get("priority") ?? ""),
              status: String(formData.get("status") ?? ""),
              companyId: String(formData.get("companyId") ?? ""),
              contactId: String(formData.get("contactId") ?? ""),
              leadId: String(formData.get("leadId") ?? ""),
              customFields,
            });

            router.push(`/crm/tasks/${taskId}`);
            return {};
          } catch (error) {
            if (error instanceof Error && "errors" in error && typeof error.errors === "object") {
              return {
                error: error.message,
                customFieldErrors: error.errors as Record<string, string>,
              };
            }
            return {
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to create task",
            };
          }
        }
      : async (_state: TaskFormState, formData: FormData) => {
          try {
            const customFields: Record<string, string> = {};
            for (const [name, value] of formData.entries()) {
              if (typeof name === "string" && name.startsWith("field:")) {
                customFields[name.slice("field:".length)] = String(value);
              }
            }

            await updateTask(task!.id, {
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              dueDate: String(formData.get("dueDate") ?? ""),
              priority: String(formData.get("priority") ?? ""),
              status: String(formData.get("status") ?? ""),
              companyId: String(formData.get("companyId") ?? ""),
              contactId: String(formData.get("contactId") ?? ""),
              leadId: String(formData.get("leadId") ?? ""),
              customFields,
            });

            router.push(`/crm/tasks/${task!.id}`);
            return {};
          } catch (error) {
            if (error instanceof Error && "errors" in error && typeof error.errors === "object") {
              return {
                error: error.message,
                customFieldErrors: error.errors as Record<string, string>,
              };
            }
            return {
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to update task",
            };
          }
        };

  const [state, formAction, pending] = useActionState(action, {});

  const formattedDueDate = task?.dueDate
    ? new Date(task.dueDate).toISOString().slice(0, 16)
    : "";
  const { getFieldState, onChange } = useOperationalConditionalFields({
    form: conditionalForm,
    customFields,
    systemValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      dueDate: formattedDueDate,
      priority: task?.priority ?? "",
      status: task?.status ?? "TODO",
    },
  });

  return (
    <form action={formAction} className="space-y-6" onChange={onChange}>
      {customFields.length > 0 ? (
        <div className="space-y-4 border-t border-black/10 pt-4 dark:border-white/10">
          <h3 className="text-lg font-semibold">Custom Fields</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {customFields.map((field) => {
              const conditionalState = getFieldState(field.key, field.required);
              return (
                <div hidden={!conditionalState.visible} key={field.id}>
                  <TaskCustomFieldControl
                    error={state.customFieldErrors?.[field.key]}
                    field={field}
                    state={conditionalState}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>

        <input
          id="title"
          name="title"
          required
          maxLength={200}
          defaultValue={task?.title ?? ""}
          className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          placeholder="Follow up with client"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>

        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={task?.description ?? ""}
          className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          placeholder="Add task details..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="dueDate" className="block text-sm font-medium">
            Due date
          </label>

          <input
            id="dueDate"
            name="dueDate"
            type="datetime-local"
            defaultValue={formattedDueDate}
            className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="priority" className="block text-sm font-medium">
            Priority
          </label>

          <select
            id="priority"
            name="priority"
            defaultValue={task?.priority ?? ""}
            className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          >
            <option value="">Not set</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="status" className="block text-sm font-medium">
          Status
        </label>

        <select
          id="status"
          name="status"
          defaultValue={task?.status ?? "TODO"}
          className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
        >
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="companyId" className="block text-sm font-medium">
            Company
          </label>

          <select
            id="companyId"
            name="companyId"
            defaultValue={task?.companyId ?? ""}
            className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          >
            <option value="">None</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="contactId" className="block text-sm font-medium">
            Contact
          </label>

          <select
            id="contactId"
            name="contactId"
            defaultValue={task?.contactId ?? ""}
            className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          >
            <option value="">None</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="leadId" className="block text-sm font-medium">
            Lead
          </label>

          <select
            id="leadId"
            name="leadId"
            defaultValue={task?.leadId ?? ""}
            className="w-full rounded-md border border-black/20 px-3 py-2 dark:border-white/20 dark:bg-black"
          >
            <option value="">None</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.firstName} {lead.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending
          ? "Saving..."
          : mode === "create"
            ? "Create task"
            : "Save changes"}
      </button>
    </form>
  );
}