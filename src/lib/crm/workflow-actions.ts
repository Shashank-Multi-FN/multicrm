import "server-only";

import {
  CrmWorkflowActionRunStatus,
  CrmWorkflowActionType,
  CrmWorkflowRunStatus,
} from "@prisma/client/index";
import { AuthorizationError } from "@/lib/auth/errors";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import type {
  WorkflowEventType,
  WorkflowModuleKey,
  WorkflowRecordSnapshot,
} from "@/lib/crm/workflows";
import { db } from "@/lib/db";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type CreateTaskActionInput = {
  taskTitle: string;
  taskDescription?: string | null;
  taskStatus?: string | null;
  taskPriority?: string | null;
  taskDueDate?: string | Date | null;
};

export type NormalizedCreateTaskAction = {
  taskTitle: string;
  taskDescription: string | null;
  taskStatus: (typeof TASK_STATUSES)[number];
  taskPriority: (typeof TASK_PRIORITIES)[number] | null;
  taskDueDate: Date | null;
};

export class WorkflowActionConfigurationError extends Error {}

export function validateCreateTaskActionConfiguration(
  input: CreateTaskActionInput,
): NormalizedCreateTaskAction {
  const taskTitle = input.taskTitle.trim();
  if (!taskTitle || taskTitle.length > 200) {
    throw new WorkflowActionConfigurationError(
      "Task title must be between 1 and 200 characters.",
    );
  }

  const taskDescription = input.taskDescription?.trim() || null;
  if (taskDescription && taskDescription.length > 2000) {
    throw new WorkflowActionConfigurationError(
      "Task description must be 2,000 characters or fewer.",
    );
  }

  const taskStatus = input.taskStatus?.trim() || "TODO";
  if (!(TASK_STATUSES as readonly string[]).includes(taskStatus)) {
    throw new WorkflowActionConfigurationError("Choose a supported Task status.");
  }

  const taskPriority = input.taskPriority?.trim() || null;
  if (
    taskPriority &&
    !(TASK_PRIORITIES as readonly string[]).includes(taskPriority)
  ) {
    throw new WorkflowActionConfigurationError("Choose a supported Task priority.");
  }

  let taskDueDate: Date | null = null;
  if (input.taskDueDate) {
    const rawDate = input.taskDueDate instanceof Date
      ? input.taskDueDate.toISOString().slice(0, 10)
      : input.taskDueDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      throw new WorkflowActionConfigurationError("Enter a valid Task due date.");
    }
    taskDueDate = new Date(`${rawDate}T00:00:00.000Z`);
    if (Number.isNaN(taskDueDate.getTime()) || taskDueDate.toISOString().slice(0, 10) !== rawDate) {
      throw new WorkflowActionConfigurationError("Enter a valid Task due date.");
    }
  }

  return { taskTitle, taskDescription, taskStatus: taskStatus as NormalizedCreateTaskAction["taskStatus"], taskPriority: taskPriority as NormalizedCreateTaskAction["taskPriority"], taskDueDate };
}

export type WorkflowActionExecutionResult = {
  actionId: string;
  status: "SUCCEEDED" | "FAILED";
  createdTaskId: string | null;
  error: string | null;
};

type EventContext = {
  tenant: Awaited<ReturnType<typeof getCrmTenantContext>>;
  workflowRunId: string;
  workflowId: string;
  moduleKey: WorkflowModuleKey;
  eventType: WorkflowEventType;
  recordId: string;
  snapshot: WorkflowRecordSnapshot;
};

function safeErrorMessage(error: unknown): string {
  if (error instanceof WorkflowActionConfigurationError) {
    return error.message.slice(0, 2000);
  }
  if (error instanceof AuthorizationError) {
    return "The triggering user is not authorized to create Tasks in this CRM.";
  }
  if (error instanceof Error && error.message === "A related CRM record is unavailable.") {
    return error.message;
  }
  return "Task creation failed.";
}

async function findActionRun(context: EventContext, actionId: string) {
  return db.crmWorkflowActionRun.findUnique({
    where: {
      crmInstanceId_moduleKey_workflowRunId_workflowActionId: {
        crmInstanceId: context.tenant.crmId,
        moduleKey: context.moduleKey,
        workflowRunId: context.workflowRunId,
        workflowActionId: actionId,
      },
    },
  });
}

async function persistFailedActionRun(
  context: EventContext,
  actionId: string,
  error: unknown,
): Promise<WorkflowActionExecutionResult> {
  const result = {
    actionId,
    status: "FAILED" as const,
    createdTaskId: null,
    error: safeErrorMessage(error),
  };
  try {
    await db.crmWorkflowActionRun.createMany({
      data: [{
        crmInstanceId: context.tenant.crmId,
        moduleKey: context.moduleKey,
        workflowId: context.workflowId,
        workflowRunId: context.workflowRunId,
        workflowActionId: actionId,
        status: CrmWorkflowActionRunStatus.FAILED,
        createdTaskId: null,
        errorMessage: result.error,
      }],
      skipDuplicates: true,
    });
    const existing = await findActionRun(context, actionId);
    if (existing?.status === CrmWorkflowActionRunStatus.SUCCEEDED) {
      return {
        actionId,
        status: "SUCCEEDED",
        createdTaskId: existing.createdTaskId,
        error: null,
      };
    }
  } catch (persistenceError) {
    console.error("CRM workflow action failure could not be persisted.", {
      crmInstanceId: context.tenant.crmId,
      workflowId: context.workflowId,
      workflowRunId: context.workflowRunId,
      actionId,
      recordId: context.recordId,
      errorName: persistenceError instanceof Error ? persistenceError.name : "UnknownError",
    });
  }
  console.error("CRM workflow action failed.", {
    crmInstanceId: context.tenant.crmId,
    workflowId: context.workflowId,
    workflowRunId: context.workflowRunId,
    actionId,
    moduleKey: context.moduleKey,
    recordId: context.recordId,
    eventType: context.eventType,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  return result;
}

async function taskRelationships(context: EventContext) {
  const { relatedRecordIds } = context.snapshot;
  const directRecordId = context.eventType === "RECORD_DELETED"
    ? null
    : context.recordId;
  const relations = {
    companyId: context.moduleKey === "companies"
      ? directRecordId
      : relatedRecordIds.companyId,
    contactId: context.moduleKey === "contacts"
      ? directRecordId
      : relatedRecordIds.contactId,
    leadId: context.moduleKey === "leads"
      ? directRecordId
      : relatedRecordIds.leadId,
  };

  const [company, contact, lead] = await Promise.all([
    relations.companyId
      ? db.company.findFirst({
          where: { id: relations.companyId, crmInstanceId: context.tenant.crmId },
          select: { id: true },
        })
      : null,
    relations.contactId
      ? db.contact.findFirst({
          where: { id: relations.contactId, crmInstanceId: context.tenant.crmId },
          select: { id: true },
        })
      : null,
    relations.leadId
      ? db.lead.findFirst({
          where: { id: relations.leadId, crmInstanceId: context.tenant.crmId },
          select: { id: true },
        })
      : null,
  ]);
  if (
    (relations.companyId && !company) ||
    (relations.contactId && !contact) ||
    (relations.leadId && !lead)
  ) {
    throw new Error("A related CRM record is unavailable.");
  }
  return relations;
}

async function executeOneAction(
  context: EventContext,
  action: {
    id: string;
    actionType: string;
    taskTitle: string | null;
    taskDescription: string | null;
    taskStatus: string | null;
    taskPriority: string | null;
    taskDueDate: Date | null;
  },
  authorizedCrmId: string | null,
): Promise<WorkflowActionExecutionResult> {
  const existing = await findActionRun(context, action.id);
  if (existing) {
    return {
      actionId: action.id,
      status: existing.status,
      createdTaskId: existing.createdTaskId,
      error: existing.errorMessage,
    };
  }

  try {
    if (authorizedCrmId !== context.tenant.crmId) {
      throw new AuthorizationError("Task creation permission is unavailable.");
    }
    if (action.actionType !== CrmWorkflowActionType.CREATE_TASK) {
      throw new WorkflowActionConfigurationError("This workflow action type is not supported.");
    }
    const config = validateCreateTaskActionConfiguration({
      taskTitle: action.taskTitle ?? "",
      taskDescription: action.taskDescription,
      taskStatus: action.taskStatus,
      taskPriority: action.taskPriority,
      taskDueDate: action.taskDueDate,
    });
    const relations = await taskRelationships(context);

    const createdTaskId = await db.$transaction(async (transaction) => {
      const task = await transaction.task.create({
        data: {
          crmInstanceId: context.tenant.crmId,
          title: config.taskTitle,
          description: config.taskDescription,
          status: config.taskStatus,
          priority: config.taskPriority,
          dueDate: config.taskDueDate,
          ...relations,
        },
        select: { id: true },
      });
      await transaction.crmWorkflowActionRun.create({
        data: {
          crmInstanceId: context.tenant.crmId,
          moduleKey: context.moduleKey,
          workflowId: context.workflowId,
          workflowRunId: context.workflowRunId,
          workflowActionId: action.id,
          status: CrmWorkflowActionRunStatus.SUCCEEDED,
          createdTaskId: task.id,
          errorMessage: null,
        },
      });
      return task.id;
    });
    return {
      actionId: action.id,
      status: "SUCCEEDED",
      createdTaskId,
      error: null,
    };
  } catch (error) {
    const raced = await findActionRun(context, action.id).catch(() => null);
    if (raced) {
      return {
        actionId: action.id,
        status: raced.status,
        createdTaskId: raced.createdTaskId,
        error: raced.errorMessage,
      };
    }
    return persistFailedActionRun(context, action.id, error);
  }
}

export async function executeMatchedWorkflowActions(context: EventContext): Promise<WorkflowActionExecutionResult[]> {
  const run = await db.crmWorkflowRun.findFirst({
    where: {
      id: context.workflowRunId,
      crmInstanceId: context.tenant.crmId,
      moduleKey: context.moduleKey,
      workflowId: context.workflowId,
      status: CrmWorkflowRunStatus.MATCHED,
    },
    select: { id: true },
  });
  if (!run) return [];

  const workflow = await db.crmWorkflow.findFirst({
    where: {
      id: context.workflowId,
      crmInstanceId: context.tenant.crmId,
      moduleKey: context.moduleKey,
      enabled: true,
      moduleConfiguration: { enabled: true },
    },
    select: { id: true },
  });
  if (!workflow) return [];

  // Workflow-created Tasks are observed, but do not recursively execute actions.
  if (
    context.moduleKey === "tasks" &&
    context.eventType === "RECORD_CREATED" &&
    await db.crmWorkflowActionRun.findFirst({
      where: {
        crmInstanceId: context.tenant.crmId,
        createdTaskId: context.recordId,
        status: CrmWorkflowActionRunStatus.SUCCEEDED,
      },
      select: { id: true },
    })
  ) {
    return [];
  }

  const actions = await db.crmWorkflowAction.findMany({
    where: {
      crmInstanceId: context.tenant.crmId,
      moduleKey: context.moduleKey,
      workflowId: context.workflowId,
      enabled: true,
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      actionType: true,
      taskTitle: true,
      taskDescription: true,
      taskStatus: true,
      taskPriority: true,
      taskDueDate: true,
    },
  });
  if (actions.length === 0) return [];

  let authorizedCrmId: string | null = null;
  try {
    const authorizedTenant = await getCrmTenantContext(CRM_PERMISSIONS.TASKS_CREATE);
    authorizedCrmId = authorizedTenant.crmId;
  } catch {
    // Each action receives a durable FAILED result below.
  }

  const results: WorkflowActionExecutionResult[] = [];
  for (const action of actions) {
    results.push(await executeOneAction(context, action, authorizedCrmId));
  }
  return results;
}
