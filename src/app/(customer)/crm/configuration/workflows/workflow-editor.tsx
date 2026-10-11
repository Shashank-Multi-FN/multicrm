"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import {
  createWorkflow,
  deleteWorkflow,
  deleteWorkflowCondition,
  deleteWorkflowAction,
  saveWorkflowCondition,
  saveWorkflowAction,
  updateWorkflow,
  type WorkflowActionState,
} from "./actions";

type FieldOption = { key: string; label: string; enabled: boolean };

type WorkflowField = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  enabled: boolean;
  options: FieldOption[];
};

type WorkflowCondition = {
  id: string;
  fieldId: string;
  operator: string;
  comparisonValue: string | null;
  enabled: boolean;
  displayOrder: number;
  field: Pick<WorkflowField, "key" | "label" | "fieldType">;
};

type Workflow = {
  id: string;
  moduleKey: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  enabled: boolean;
  displayOrder: number;
  conditions: WorkflowCondition[];
  actions: WorkflowActionConfig[];
};

type WorkflowActionConfig = {
  id: string;
  actionType: string;
  enabled: boolean;
  displayOrder: number;
  taskTitle: string | null;
  taskDescription: string | null;
  taskStatus: string | null;
  taskPriority: string | null;
  taskDueDate: Date | null;
};

type WorkflowModule = {
  moduleKey: string;
  label: string;
  fields: WorkflowField[];
};

type Action = (
  previous: WorkflowActionState,
  formData: FormData,
) => Promise<WorkflowActionState>;

const inputClass =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 dark:border-white/20 dark:bg-zinc-950";

function Feedback({ state }: { state: WorkflowActionState }) {
  return state.error || state.success ? (
    <p
      aria-live="polite"
      className={
        state.error
          ? "text-sm text-red-600 dark:text-red-400"
          : "text-sm text-green-700 dark:text-green-400"
      }
    >
      {state.error ?? state.success}
    </p>
  ) : null;
}

function SubmitForm({
  action,
  children,
  submitLabel,
  className = "space-y-3",
}: {
  action: Action;
  children: ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <Feedback state={state} />
      <button
        className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function ComparisonInput({
  field,
  operator,
  value,
}: {
  field?: WorkflowField;
  operator: string;
  value: string | null;
}) {
  if (!field || operator === "IS_EMPTY" || operator === "IS_NOT_EMPTY") {
    return null;
  }
  if (field.fieldType === "SELECT") {
    return (
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Stable option key</span>
        <select
          className={inputClass}
          defaultValue={value ?? ""}
          name="comparisonValue"
          required
        >
          <option value="">Choose an enabled option</option>
          {field.options.filter((option) => option.enabled).map((option) => (
            <option key={option.key} value={option.key}>
              {option.key} · {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.fieldType === "BOOLEAN") {
    return (
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Boolean value</span>
        <select
          className={inputClass}
          defaultValue={value ?? ""}
          name="comparisonValue"
          required
        >
          <option value="">Choose a value</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </label>
    );
  }
  const type =
    field.fieldType === "NUMBER"
      ? "number"
      : field.fieldType === "DATE"
        ? "date"
        : field.fieldType === "DATETIME"
          ? "datetime-local"
          : "text";
  return (
    <label className="space-y-1 text-sm">
      <span className="block font-medium">Comparison value</span>
      <input
        className={inputClass}
        defaultValue={value ?? ""}
        name="comparisonValue"
        required
        step={type === "number" ? "any" : undefined}
        type={type}
      />
    </label>
  );
}

function ConditionForm({
  workflow,
  fields,
  condition,
}: {
  workflow: Workflow;
  fields: WorkflowField[];
  condition?: WorkflowCondition;
}) {
  const [state, formAction, pending] = useActionState(saveWorkflowCondition, {});
  const [fieldId, setFieldId] = useState(
    condition?.fieldId ?? fields[0]?.id ?? "",
  );
  const [operator, setOperator] = useState(
    condition?.operator ?? "EQUALS",
  );
  const field = fields.find((candidate) => candidate.id === fieldId);

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/15"
    >
      <input name="workflowId" type="hidden" value={workflow.id} />
      {condition ? (
        <input name="conditionId" type="hidden" value={condition.id} />
      ) : null}
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Field</span>
        <select
          className={inputClass}
          name="fieldId"
          onChange={(event) => setFieldId(event.target.value)}
          value={fieldId}
        >
          {fields.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label} ({candidate.key})
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Operator</span>
        <select
          className={inputClass}
          name="operator"
          onChange={(event) => setOperator(event.target.value)}
          value={operator}
        >
          <option value="EQUALS">Equals</option>
          <option value="NOT_EQUALS">Does not equal</option>
          <option value="IS_EMPTY">Is empty</option>
          <option value="IS_NOT_EMPTY">Is not empty</option>
        </select>
      </label>
      <ComparisonInput
        key={`${fieldId}:${operator}`}
        field={field}
        operator={operator}
        value={
          condition?.fieldId === fieldId && condition.operator === operator
            ? condition.comparisonValue
            : null
        }
      />
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Order</span>
        <input
          className={inputClass}
          defaultValue={condition?.displayOrder ?? workflow.conditions.length}
          min={0}
          name="displayOrder"
          type="number"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          defaultChecked={condition?.enabled ?? true}
          name="enabled"
          type="checkbox"
        />
        Enabled
      </label>
      <div className="space-y-2 sm:col-span-2">
        <button
          className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          disabled={pending || fields.length === 0}
          type="submit"
        >
          {pending
            ? "Saving..."
            : condition
              ? "Save condition"
              : "Add condition"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function DeleteCondition({ conditionId }: { conditionId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteWorkflowCondition,
    {},
  );
  return (
    <form action={formAction} className="space-y-2">
      <input name="conditionId" type="hidden" value={conditionId} />
      <button
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-300"
        disabled={pending}
        type="submit"
      >
        Delete condition
      </button>
      <Feedback state={state} />
    </form>
  );
}

function WorkflowActionForm({
  workflow,
  action,
}: {
  workflow: Workflow;
  action?: WorkflowActionConfig;
}) {
  const [state, formAction, pending] = useActionState(saveWorkflowAction, {});
  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-black/10 p-4 sm:grid-cols-2 dark:border-white/15">
      <input name="workflowId" type="hidden" value={workflow.id} />
      {action ? <input name="actionId" type="hidden" value={action.id} /> : null}
      <p className="text-sm font-medium sm:col-span-2">Create Task</p>
      <label className="space-y-1 text-sm sm:col-span-2">
        <span className="block font-medium">Task title</span>
        <input className={inputClass} defaultValue={action?.taskTitle ?? ""} maxLength={200} name="taskTitle" required />
      </label>
      <label className="space-y-1 text-sm sm:col-span-2">
        <span className="block font-medium">Description (optional)</span>
        <textarea className={inputClass} defaultValue={action?.taskDescription ?? ""} maxLength={2000} name="taskDescription" rows={2} />
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Status</span>
        <select className={inputClass} defaultValue={action?.taskStatus ?? "TODO"} name="taskStatus">
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Priority</span>
        <select className={inputClass} defaultValue={action?.taskPriority ?? ""} name="taskPriority">
          <option value="">None</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Due date (optional)</span>
        <input className={inputClass} defaultValue={action?.taskDueDate?.toISOString().slice(0, 10) ?? ""} name="taskDueDate" type="date" />
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Action order</span>
        <input className={inputClass} defaultValue={action?.displayOrder ?? workflow.actions.length} min={0} name="displayOrder" type="number" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={action?.enabled ?? true} name="enabled" type="checkbox" />
        Enabled
      </label>
      <div className="space-y-2 sm:col-span-2">
        <button className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Saving..." : action ? "Save Task action" : "Add Task action"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function DeleteWorkflowAction({ actionId }: { actionId: string }) {
  const [state, formAction, pending] = useActionState(deleteWorkflowAction, {});
  return (
    <form action={formAction} className="space-y-2">
      <input name="actionId" type="hidden" value={actionId} />
      <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-300" disabled={pending} type="submit">
        Delete action
      </button>
      <Feedback state={state} />
    </form>
  );
}

export default function WorkflowEditor({
  modules,
  workflows,
  canManage,
}: {
  modules: WorkflowModule[];
  workflows: Workflow[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-8">
      <Link
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        href="/crm/configuration"
      >
        ← CRM configuration
      </Link>
      {!canManage ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          You have read-only access. CRM owners and admins can manage workflows.
        </p>
      ) : null}
      {canManage ? (
        <section className="space-y-4 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]">
          <h2 className="text-xl font-semibold">Create workflow</h2>
          <SubmitForm
            action={createWorkflow}
            className="grid gap-4 sm:grid-cols-2"
            submitLabel="Create workflow"
          >
            <label className="space-y-1 text-sm">
              <span className="block font-medium">CRM module</span>
              <select className={inputClass} name="moduleKey" required>
                {modules.map((module) => (
                  <option key={module.moduleKey} value={module.moduleKey}>
                    {module.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Trigger</span>
              <select className={inputClass} name="triggerEvent" required>
                <option value="RECORD_CREATED">Record created</option>
                <option value="RECORD_UPDATED">Record updated</option>
                <option value="RECORD_DELETED">Record deleted</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Name</span>
              <input className={inputClass} maxLength={120} name="name" required />
            </label>
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Display order</span>
              <input
                className={inputClass}
                defaultValue={workflows.length}
                min={0}
                name="displayOrder"
                type="number"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="block font-medium">Description (optional)</span>
              <textarea
                className={inputClass}
                maxLength={1000}
                name="description"
                rows={2}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input defaultChecked name="enabled" type="checkbox" />
              Enabled
            </label>
          </SubmitForm>
        </section>
      ) : null}

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold">Workflows</h2>
        {workflows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-sm text-zinc-600 dark:text-zinc-400">
            No workflows have been configured.
          </p>
        ) : null}
        {workflows.map((workflow) => {
          const workflowModule = modules.find(
            (candidate) => candidate.moduleKey === workflow.moduleKey,
          );
          const fields = workflowModule?.fields ?? [];
          return (
            <article
              className="space-y-5 rounded-xl border border-black/[.08] p-5 dark:border-white/[.145]"
              key={workflow.id}
            >
              <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{workflow.name}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {workflowModule?.label ?? workflow.moduleKey} · {workflow.triggerEvent.replaceAll("_", " ")}
                  </p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs">
                  {workflow.enabled ? "Enabled" : "Disabled"}
                </span>
              </header>
              {canManage ? (
                <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
                  <SubmitForm
                    action={updateWorkflow}
                    className="grid gap-3 sm:grid-cols-2"
                    submitLabel="Save workflow"
                  >
                    <input name="workflowId" type="hidden" value={workflow.id} />
                    <label className="space-y-1 text-sm">
                      <span className="block font-medium">Name</span>
                      <input
                        className={inputClass}
                        defaultValue={workflow.name}
                        maxLength={120}
                        name="name"
                        required
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="block font-medium">Display order</span>
                      <input
                        className={inputClass}
                        defaultValue={workflow.displayOrder}
                        min={0}
                        name="displayOrder"
                        type="number"
                      />
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="block font-medium">Description</span>
                      <textarea
                        className={inputClass}
                        defaultValue={workflow.description ?? ""}
                        maxLength={1000}
                        name="description"
                        rows={2}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        defaultChecked={workflow.enabled}
                        name="enabled"
                        type="checkbox"
                      />
                      Enabled
                    </label>
                  </SubmitForm>
                  <SubmitForm
                    action={deleteWorkflow}
                    className="self-start"
                    submitLabel="Delete workflow"
                  >
                    <input name="workflowId" type="hidden" value={workflow.id} />
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Deleting this workflow also removes its conditions.
                    </p>
                  </SubmitForm>
                </div>
              ) : null}
              <div className="space-y-3">
                <h4 className="font-medium">Conditions (all must match)</h4>
                {workflow.conditions.map((condition) => (
                  <div
                    className="grid gap-3 rounded-lg bg-black/[.03] p-3 dark:bg-white/[.04] lg:grid-cols-[1fr_auto]"
                    key={condition.id}
                  >
                    {canManage ? (
                      <ConditionForm
                        condition={condition}
                        fields={fields}
                        workflow={workflow}
                      />
                    ) : (
                      <p className="text-sm">
                        {condition.field.label} {condition.operator.replaceAll("_", " ")}
                        {condition.comparisonValue
                          ? ` ${condition.comparisonValue}`
                          : ""}
                        {!condition.enabled ? " · Disabled" : ""}
                      </p>
                    )}
                    {canManage ? (
                      <DeleteCondition conditionId={condition.id} />
                    ) : null}
                  </div>
                ))}
                {canManage ? (
                  fields.length > 0 ? (
                    <ConditionForm fields={fields} workflow={workflow} />
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      No fields are available for conditions in this module.
                    </p>
                  )
                ) : workflow.conditions.length === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    This workflow has no conditions and matches every event of its trigger.
                  </p>
                ) : null}
              </div>
              <div className="space-y-3">
                <h4 className="font-medium">Actions</h4>
                {workflow.actions.length === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">No actions configured.</p>
                ) : null}
                {workflow.actions.map((action) => (
                  <div className="grid gap-3 rounded-lg bg-black/[.03] p-3 dark:bg-white/[.04] lg:grid-cols-[1fr_auto]" key={action.id}>
                    {canManage ? (
                      <WorkflowActionForm action={action} workflow={workflow} />
                    ) : (
                      <p className="text-sm">
                        Create Task: {action.taskTitle} · {action.taskStatus ?? "TODO"}
                        {action.taskPriority ? ` · ${action.taskPriority}` : ""}
                        {!action.enabled ? " · Disabled" : ""}
                      </p>
                    )}
                    {canManage ? <DeleteWorkflowAction actionId={action.id} /> : null}
                  </div>
                ))}
                {canManage ? <WorkflowActionForm workflow={workflow} /> : null}
              </div>
            </article>
          );
        })}
      </section>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enabled Task actions run after matching workflow events. Workflow-created
        Tasks are evaluated for Task workflows but do not start further actions.
      </p>
    </div>
  );
}
