"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import {
  buildCustomFieldPayloadForModule,
  normalizeCustomFieldInputValue,
  resolveCustomFieldValuesForModule,
} from "@/lib/crm/custom-field-values";
import { getCrmOperationalForm } from "@/lib/crm/runtime-forms";
import {
  captureWorkflowRecordSnapshotSafely,
  createWorkflowObservationId,
  observeWorkflowEvent,
} from "@/lib/crm/workflows";

type TaskInput = {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  customFields?: Record<string, string>;
};

class TaskCustomFieldValidationError extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("Please correct the highlighted custom fields.");
    this.name = "TaskCustomFieldValidationError";
  }
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateChoice(
  value: string | undefined,
  choices: readonly string[],
  label: string,
) {
  const cleaned = cleanOptional(value);

  if (cleaned && !choices.includes(cleaned)) {
    throw new Error(`Invalid task ${label.toLowerCase()}`);
  }

  return cleaned;
}

function parseDueDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid due date");
  }

  return date;
}

function validateTitle(title: string) {
  const value = title.trim();

  if (!value) {
    throw new Error("Task title is required");
  }

  if (value.length > 200) {
    throw new Error("Task title must be 200 characters or fewer");
  }

  return value;
}

function buildCustomFieldFormData(customFields?: Record<string, string>) {
  const formData = new FormData();
  if (!customFields) {
    return formData;
  }

  for (const [key, value] of Object.entries(customFields)) {
    if (typeof value === "undefined") {
      continue;
    }
    formData.append(`field:${key}`, value);
  }

  return formData;
}

async function validateTaskCustomFields({
  tenant,
  customFields,
  conditionalForm,
  systemValues,
}: {
  tenant: Awaited<ReturnType<typeof getCrmTenantContext>>;
  customFields?: Record<string, string>;
  conditionalForm: Awaited<ReturnType<typeof getCrmOperationalForm>>;
  systemValues: Record<string, unknown>;
}) {
  const formData = buildCustomFieldFormData(customFields);
  const resolved = await resolveCustomFieldValuesForModule({
    tenant,
    moduleKey: "tasks",
    formData,
    conditionalForm,
    systemValues,
  });

  if (!resolved.valid) {
    throw new TaskCustomFieldValidationError(resolved.errors);
  }

  return resolved;
}

async function validateRelations(
  crmInstanceId: string,
  input: TaskInput,
) {
  const companyId = cleanOptional(input.companyId);
  const contactId = cleanOptional(input.contactId);
  const leadId = cleanOptional(input.leadId);

  if (companyId) {
    const company = await db.company.findFirst({
      where: {
        id: companyId,
        crmInstanceId,
      },
      select: {
        id: true,
      },
    });

    if (!company) {
      throw new Error("Selected company does not belong to this CRM");
    }
  }

  if (contactId) {
    const contact = await db.contact.findFirst({
      where: {
        id: contactId,
        crmInstanceId,
      },
      select: {
        id: true,
      },
    });

    if (!contact) {
      throw new Error("Selected contact does not belong to this CRM");
    }
  }

  if (leadId) {
    const lead = await db.lead.findFirst({
      where: {
        id: leadId,
        crmInstanceId,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      throw new Error("Selected lead does not belong to this CRM");
    }
  }

  return {
    companyId,
    contactId,
    leadId,
  };
}

export async function createTask(input: TaskInput): Promise<string> {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_CREATE);

  const title = validateTitle(input.title);
  const description = cleanOptional(input.description);
  const priority = validateChoice(input.priority, PRIORITIES, "priority");
  const status =
    validateChoice(input.status, STATUSES, "status") ?? "TODO";
  const dueDate = parseDueDate(input.dueDate);

  const relations = await validateRelations(tenant.crmId, input);
  const conditionalForm = await getCrmOperationalForm({
    tenant,
    moduleKey: "tasks",
    operation: "create",
  });
  const customFields = await validateTaskCustomFields({
    tenant,
    customFields: input.customFields,
    conditionalForm,
    systemValues: {
      title,
      description: description ?? "",
      dueDate: input.dueDate?.trim() ?? "",
      priority: priority ?? "",
      status,
    },
  });

  const task = await db.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        crmInstanceId: tenant.crmId,
        title,
        description,
        dueDate,
        priority,
        status,
        companyId: relations.companyId,
        contactId: relations.contactId,
        leadId: relations.leadId,
      },
      select: {
        id: true,
      },
    });

    for (const field of customFields.fields) {
      const value = normalizeCustomFieldInputValue(customFields.values[field.key]);
      const payload = buildCustomFieldPayloadForModule({
        moduleKey: "tasks",
        field: {
          id: field.id,
          key: field.key,
          fieldType: field.fieldType,
          options: field.options.map((option) => ({
            id: option.id,
            key: option.key,
          })),
        },
        value,
        recordId: created.id,
        crmInstanceId: tenant.crmId,
      });

      if (payload === null) {
        const existing = await tx.customTaskFieldValue.findUnique({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "tasks",
              recordId: created.id,
              fieldId: field.id,
            },
          },
        });
        if (existing) {
          await tx.customTaskFieldValue.delete({ where: { id: existing.id } });
        }
        continue;
      }

      await tx.customTaskFieldValue.upsert({
        where: {
          crmInstanceId_moduleKey_recordId_fieldId: {
            crmInstanceId: tenant.crmId,
            moduleKey: "tasks",
            recordId: created.id,
            fieldId: field.id,
          },
        },
        create: payload,
        update: payload,
      });
    }

    return created;
  });

  const workflowAfter = await captureWorkflowRecordSnapshotSafely({
    tenant,
    moduleKey: "tasks",
    recordId: task.id,
  });
  const workflowEventId = createWorkflowObservationId({
    moduleKey: "tasks",
    recordId: task.id,
    eventType: "RECORD_CREATED",
    snapshot: workflowAfter,
  });
  await observeWorkflowEvent({
    tenant,
    moduleKey: "tasks",
    eventType: "RECORD_CREATED",
    recordId: task.id,
    eventId: workflowEventId,
    before: null,
    after: workflowAfter,
  });

  revalidatePath("/crm/tasks");
  revalidatePath(`/crm/tasks/${task.id}`);
  return task.id;
}

export async function updateTask(
  taskId: string,
  input: TaskInput,
) {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_UPDATE);

  const existingTask = await db.task.findFirst({
    where: {
      id: taskId,
      crmInstanceId: tenant.crmId,
    },
    select: {
      id: true,
    },
  });

  if (!existingTask) {
    throw new Error("Task not found");
  }

  const title = validateTitle(input.title);
  const description = cleanOptional(input.description);
  const priority = validateChoice(input.priority, PRIORITIES, "priority");
  const status =
    validateChoice(input.status, STATUSES, "status") ?? "TODO";
  const dueDate = parseDueDate(input.dueDate);

  const relations = await validateRelations(tenant.crmId, input);
  const conditionalForm = await getCrmOperationalForm({
    tenant,
    moduleKey: "tasks",
    operation: "edit",
  });
  const customFields = await validateTaskCustomFields({
    tenant,
    customFields: input.customFields,
    conditionalForm,
    systemValues: {
      title,
      description: description ?? "",
      dueDate: input.dueDate?.trim() ?? "",
      priority: priority ?? "",
      status,
    },
  });

  const workflowBefore = await captureWorkflowRecordSnapshotSafely({
    tenant,
    moduleKey: "tasks",
    recordId: taskId,
  });
  await db.$transaction(async (tx) => {
    const result = await tx.task.updateMany({
      where: {
        id: taskId,
        crmInstanceId: tenant.crmId,
      },
      data: {
        title,
        description,
        dueDate,
        priority,
        status,
        companyId: relations.companyId,
        contactId: relations.contactId,
        leadId: relations.leadId,
      },
    });

    if (result.count !== 1) {
      throw new Error("Task not found");
    }

    for (const field of customFields.fields) {
      const value = normalizeCustomFieldInputValue(customFields.values[field.key]);
      const payload = buildCustomFieldPayloadForModule({
        moduleKey: "tasks",
        field: {
          id: field.id,
          key: field.key,
          fieldType: field.fieldType,
          options: field.options.map((option) => ({
            id: option.id,
            key: option.key,
          })),
        },
        value,
        recordId: taskId,
        crmInstanceId: tenant.crmId,
      });

      if (payload === null) {
        const existing = await tx.customTaskFieldValue.findUnique({
          where: {
            crmInstanceId_moduleKey_recordId_fieldId: {
              crmInstanceId: tenant.crmId,
              moduleKey: "tasks",
              recordId: taskId,
              fieldId: field.id,
            },
          },
        });
        if (existing) {
          await tx.customTaskFieldValue.delete({ where: { id: existing.id } });
        }
        continue;
      }

      await tx.customTaskFieldValue.upsert({
        where: {
          crmInstanceId_moduleKey_recordId_fieldId: {
            crmInstanceId: tenant.crmId,
            moduleKey: "tasks",
            recordId: taskId,
            fieldId: field.id,
          },
        },
        create: payload,
        update: payload,
      });
    }
  });

  const workflowAfter = await captureWorkflowRecordSnapshotSafely({
    tenant,
    moduleKey: "tasks",
    recordId: taskId,
  });
  const workflowEventId = createWorkflowObservationId({
    moduleKey: "tasks",
    recordId: taskId,
    eventType: "RECORD_UPDATED",
    snapshot: workflowAfter,
  });
  await observeWorkflowEvent({
    tenant,
    moduleKey: "tasks",
    eventType: "RECORD_UPDATED",
    recordId: taskId,
    eventId: workflowEventId,
    before: workflowBefore,
    after: workflowAfter,
  });

  revalidatePath("/crm/tasks");
  revalidatePath(`/crm/tasks/${taskId}`);
}

export async function deleteTask(taskId: string) {
  const tenant = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_DELETE);
  const { crmId } = tenant;

  const existingTask = await db.task.findFirst({
    where: {
      id: taskId,
      crmInstanceId: crmId,
    },
    select: {
      id: true,
    },
  });

  if (!existingTask) {
    throw new Error("Task not found");
  }

  const workflowBefore = await captureWorkflowRecordSnapshotSafely({
    tenant,
    moduleKey: "tasks",
    recordId: taskId,
  });
  const workflowEventId = createWorkflowObservationId({
    moduleKey: "tasks",
    recordId: taskId,
    eventType: "RECORD_DELETED",
    snapshot: workflowBefore,
  });
  const result = await db.task.deleteMany({
    where: {
      id: taskId,
      crmInstanceId: crmId,
    },
  });

  if (result.count !== 1) {
    throw new Error("Task not found");
  }

  await observeWorkflowEvent({
    tenant,
    moduleKey: "tasks",
    eventType: "RECORD_DELETED",
    recordId: taskId,
    eventId: workflowEventId,
    before: workflowBefore,
    after: null,
  });

  revalidatePath("/crm/tasks");
}
