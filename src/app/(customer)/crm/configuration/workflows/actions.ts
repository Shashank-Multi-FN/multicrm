"use server";

import {
  CrmConditionalOperator,
  CrmFieldType,
  CrmWorkflowEvent,
  CrmWorkflowActionType,
  Prisma,
} from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  ConditionalRuleValidationError,
  normalizeConditionalComparisonValue,
} from "@/lib/crm/conditional-logic";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import {
  isWorkflowEventType,
  WORKFLOW_MODULES,
  workflowFieldMetadata,
} from "@/lib/crm/workflows";
import { db } from "@/lib/db";
import {
  validateCreateTaskActionConfiguration,
  WorkflowActionConfigurationError,
} from "@/lib/crm/workflow-actions";

export type WorkflowActionState = {
  error?: string;
  success?: string;
};

class WorkflowInputError extends Error {}

const OPERATORS = Object.values(CrmConditionalOperator);
const FIELD_TYPES = Object.values(CrmFieldType);

function fieldValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function parsedOrder(formData: FormData): number {
  const raw = fieldValue(formData, "displayOrder");
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1_000_000) {
    throw new WorkflowInputError("Display order must be a non-negative integer.");
  }
  return parsed;
}

async function auditWorkflowChange({
  transaction,
  crmInstanceId,
  moduleKey,
  entityId,
  action,
  entityType = "crm_workflow",
  actorUserId,
  details,
}: {
  transaction: Prisma.TransactionClient;
  crmInstanceId: string;
  moduleKey: string;
  entityId: string;
  action: string;
  entityType?: string;
  actorUserId: string;
  details: Prisma.InputJsonObject;
}) {
  await transaction.crmConfigurationAuditLog.create({
    data: {
      crmInstanceId,
      moduleKey,
      entityType,
      entityId,
      action,
      actorUserId,
      details,
    },
  });
}

async function moduleInCrm(crmInstanceId: string, moduleKey: string) {
  if (!(WORKFLOW_MODULES as readonly string[]).includes(moduleKey)) {
    throw new WorkflowInputError("Choose a supported CRM module.");
  }
  const moduleConfiguration = await db.crmModuleConfiguration.findUnique({
    where: {
      crmInstanceId_moduleKey: { crmInstanceId, moduleKey },
    },
    select: { enabled: true },
  });
  if (!moduleConfiguration?.enabled) {
    throw new WorkflowInputError("The selected CRM module is unavailable.");
  }
}

async function finish(message: string): Promise<WorkflowActionState> {
  revalidatePath("/crm/configuration");
  revalidatePath("/crm/configuration/workflows");
  return { success: message };
}

async function runAction(
  action: (
    tenant: Awaited<ReturnType<typeof getCrmTenantContext>>,
    formData: FormData,
  ) => Promise<WorkflowActionState>,
  formData: FormData,
): Promise<WorkflowActionState> {
  try {
    const tenant = await getCrmTenantContext(CRM_PERMISSIONS.WORKFLOWS_MANAGE);
    return await action(tenant, formData);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to manage workflows in this CRM." };
    }
    if (
      error instanceof WorkflowInputError ||
      error instanceof ConditionalRuleValidationError ||
      error instanceof WorkflowActionConfigurationError
    ) {
      return { error: error.message };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "A workflow with that identity already exists." };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error: "This configuration has recorded history and cannot be deleted. Disable it instead.",
      };
    }
    console.error("CRM workflow configuration action failed.", error);
    return { error: "Unable to save this workflow configuration right now." };
  }
}

export async function saveWorkflowAction(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const workflowId = fieldValue(formData, "workflowId");
    const actionId = fieldValue(formData, "actionId");
    const workflow = await db.crmWorkflow.findFirst({
      where: { id: workflowId, crmInstanceId: tenant.crmId },
      select: { id: true, moduleKey: true, enabled: true },
    });
    if (!workflow) throw new WorkflowInputError("Workflow was not found in this CRM.");

    const taskDueDate = fieldValue(formData, "taskDueDate") || null;
    const config = validateCreateTaskActionConfiguration({
      taskTitle: fieldValue(formData, "taskTitle"),
      taskDescription: fieldValue(formData, "taskDescription"),
      taskStatus: fieldValue(formData, "taskStatus") || null,
      taskPriority: fieldValue(formData, "taskPriority") || null,
      taskDueDate,
    });
    const displayOrder = parsedOrder(formData);
    const enabled = formData.get("enabled") === "on";
    const data = {
      actionType: CrmWorkflowActionType.CREATE_TASK,
      enabled,
      displayOrder,
      taskTitle: config.taskTitle,
      taskDescription: config.taskDescription,
      taskStatus: config.taskStatus,
      taskPriority: config.taskPriority,
      taskDueDate: config.taskDueDate,
    };

    await db.$transaction(async (transaction) => {
      let saved;
      if (actionId) {
        const existing = await transaction.crmWorkflowAction.findFirst({
          where: {
            id: actionId,
            crmInstanceId: tenant.crmId,
            moduleKey: workflow.moduleKey,
            workflowId: workflow.id,
          },
          select: { id: true },
        });
        if (!existing) throw new WorkflowInputError("Workflow action was not found.");
        saved = await transaction.crmWorkflowAction.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
      } else {
        saved = await transaction.crmWorkflowAction.create({
          data: {
            crmInstanceId: tenant.crmId,
            moduleKey: workflow.moduleKey,
            workflowId: workflow.id,
            ...data,
          },
          select: { id: true },
        });
      }
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey: workflow.moduleKey,
        entityId: saved.id,
        entityType: "crm_workflow_action",
        action: actionId ? "workflow_action_updated" : "workflow_action_added",
        actorUserId: tenant.userId,
        details: {
          workflowId: workflow.id,
          actionType: CrmWorkflowActionType.CREATE_TASK,
          enabled,
          displayOrder,
          taskTitle: config.taskTitle,
        },
      });
    });
    return finish(actionId ? "Workflow action saved." : "Task action added.");
  }, formData);
}

export async function deleteWorkflowAction(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const actionId = fieldValue(formData, "actionId");
    if (!actionId) throw new WorkflowInputError("Workflow action could not be identified.");
    const existing = await db.crmWorkflowAction.findFirst({
      where: { id: actionId, crmInstanceId: tenant.crmId },
      select: { id: true, moduleKey: true, workflowId: true },
    });
    if (!existing) throw new WorkflowInputError("Workflow action was not found in this CRM.");
    const runCount = await db.crmWorkflowActionRun.count({
      where: { crmInstanceId: tenant.crmId, workflowActionId: existing.id },
    });
    if (runCount > 0) {
      throw new WorkflowInputError("This action has execution history. Disable it instead of deleting it.");
    }
    await db.$transaction(async (transaction) => {
      await transaction.crmWorkflowAction.delete({ where: { id: existing.id } });
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey: existing.moduleKey,
        entityId: existing.id,
        entityType: "crm_workflow_action",
        action: "workflow_action_deleted",
        actorUserId: tenant.userId,
        details: { workflowId: existing.workflowId },
      });
    });
    return finish("Workflow action deleted.");
  }, formData);
}

export async function createWorkflow(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const moduleKey = fieldValue(formData, "moduleKey");
    const name = fieldValue(formData, "name");
    const description = fieldValue(formData, "description");
    const triggerEvent = fieldValue(formData, "triggerEvent");
    if (!name || name.length > 120) {
      throw new WorkflowInputError("Workflow name must be between 1 and 120 characters.");
    }
    if (description.length > 1000) {
      throw new WorkflowInputError("Description must be 1000 characters or fewer.");
    }
    if (!isWorkflowEventType(triggerEvent)) {
      throw new WorkflowInputError("Choose a supported record trigger.");
    }
    await moduleInCrm(tenant.crmId, moduleKey);
    const displayOrder = parsedOrder(formData);

    await db.$transaction(async (transaction) => {
      const workflow = await transaction.crmWorkflow.create({
        data: {
          crmInstanceId: tenant.crmId,
          moduleKey,
          name,
          description: description || null,
          triggerEvent: triggerEvent as CrmWorkflowEvent,
          enabled: formData.get("enabled") === "on",
          displayOrder,
        },
        select: { id: true },
      });
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey,
        entityId: workflow.id,
        action: "workflow_created",
        actorUserId: tenant.userId,
        details: { name, triggerEvent, enabled: formData.get("enabled") === "on" },
      });
    });
    return finish("Workflow created.");
  }, formData);
}

export async function updateWorkflow(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const workflowId = fieldValue(formData, "workflowId");
    const name = fieldValue(formData, "name");
    const description = fieldValue(formData, "description");
    if (!workflowId) throw new WorkflowInputError("Workflow could not be identified.");
    if (!name || name.length > 120) {
      throw new WorkflowInputError("Workflow name must be between 1 and 120 characters.");
    }
    if (description.length > 1000) {
      throw new WorkflowInputError("Description must be 1000 characters or fewer.");
    }

    const existing = await db.crmWorkflow.findFirst({
      where: { id: workflowId, crmInstanceId: tenant.crmId },
      select: {
        id: true,
        moduleKey: true,
        enabled: true,
      },
    });
    if (!existing) throw new WorkflowInputError("Workflow was not found in this CRM.");
    const wasEnabled = existing.enabled;
    const enabled = formData.get("enabled") === "on";
    const displayOrder = parsedOrder(formData);
    await db.$transaction(async (transaction) => {
      await transaction.crmWorkflow.update({
        where: { id: existing.id },
        data: { name, description: description || null, enabled, displayOrder },
      });
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey: existing.moduleKey,
        entityId: existing.id,
        action:
          wasEnabled === enabled
            ? "workflow_updated"
            : enabled
              ? "workflow_enabled"
              : "workflow_disabled",
        actorUserId: tenant.userId,
        details: { name, enabled, displayOrder },
      });
    });
    return finish("Workflow saved.");
  }, formData);
}

export async function deleteWorkflow(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const workflowId = fieldValue(formData, "workflowId");
    if (!workflowId) throw new WorkflowInputError("Workflow could not be identified.");
    const existing = await db.crmWorkflow.findFirst({
      where: { id: workflowId, crmInstanceId: tenant.crmId },
      select: {
        id: true,
        moduleKey: true,
        conditions: {
          select: { id: true, fieldId: true },
        },
      },
    });
    if (!existing) throw new WorkflowInputError("Workflow was not found in this CRM.");

    await db.$transaction(async (transaction) => {
      await transaction.crmWorkflow.delete({ where: { id: existing.id } });
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey: existing.moduleKey,
        entityId: existing.id,
        action: "workflow_deleted",
        actorUserId: tenant.userId,
        details: { conditionCount: existing.conditions.length },
      });
      if (existing.conditions.length > 0) {
        await transaction.crmConfigurationAuditLog.createMany({
          data: existing.conditions.map((condition) => ({
            crmInstanceId: tenant.crmId,
            moduleKey: existing.moduleKey,
            entityType: "crm_workflow_condition",
            entityId: condition.id,
            action: "workflow_condition_deleted",
            actorUserId: tenant.userId,
            details: {
              workflowId: existing.id,
              fieldId: condition.fieldId,
              reason: "workflow_deleted",
            },
          })),
        });
      }
    });
    return finish("Workflow deleted.");
  }, formData);
}

export async function saveWorkflowCondition(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const workflowId = fieldValue(formData, "workflowId");
    const conditionId = fieldValue(formData, "conditionId");
    const fieldId = fieldValue(formData, "fieldId");
    const operator = fieldValue(formData, "operator");
    const rawComparison = formData.get("comparisonValue");
    const comparisonValue =
      rawComparison === null || rawComparison === ""
        ? null
        : typeof rawComparison === "string"
          ? rawComparison.trim()
          : (() => {
              throw new WorkflowInputError("Invalid comparison value.");
            })();
    if (!workflowId || !fieldId) {
      throw new WorkflowInputError("Choose a workflow and condition field.");
    }
    const workflow = await db.crmWorkflow.findFirst({
      where: { id: workflowId, crmInstanceId: tenant.crmId },
      select: { id: true, moduleKey: true },
    });
    if (!workflow) throw new WorkflowInputError("Workflow was not found in this CRM.");

    const field = await db.crmFieldDefinition.findFirst({
      where: {
        id: fieldId,
        crmInstanceId: tenant.crmId,
        moduleKey: workflow.moduleKey,
        enabled: true,
        moduleConfiguration: { enabled: true },
      },
      select: {
        id: true,
        key: true,
        crmInstanceId: true,
        moduleKey: true,
        fieldType: true,
        enabled: true,
        options: {
          where: { enabled: true },
          select: { key: true, enabled: true },
        },
      },
    });
    if (!field || !FIELD_TYPES.includes(field.fieldType)) {
      throw new WorkflowInputError("Condition field was not found or is disabled.");
    }
    if (!OPERATORS.includes(operator as CrmConditionalOperator)) {
      throw new WorkflowInputError("Choose a supported condition operator.");
    }
    const normalizedComparison = normalizeConditionalComparisonValue(
      workflowFieldMetadata(field),
      operator,
      comparisonValue,
    );
    const displayOrder = parsedOrder(formData);
    const enabled = formData.get("enabled") === "on";

    if (conditionId) {
      const existing = await db.crmWorkflowCondition.findFirst({
        where: {
          id: conditionId,
          crmInstanceId: tenant.crmId,
          moduleKey: workflow.moduleKey,
          workflowId: workflow.id,
        },
        select: { id: true, fieldId: true },
      });
      if (!existing) {
        throw new WorkflowInputError("Condition was not found in this workflow.");
      }
      await db.$transaction(async (transaction) => {
        await transaction.crmWorkflowCondition.update({
          where: { id: existing.id },
          data: {
            fieldId: field.id,
            operator: operator as CrmConditionalOperator,
            comparisonValue: normalizedComparison,
            enabled,
            displayOrder,
          },
        });
        await auditWorkflowChange({
          transaction,
          crmInstanceId: tenant.crmId,
          moduleKey: workflow.moduleKey,
          entityId: existing.id,
          action: "workflow_condition_updated",
          actorUserId: tenant.userId,
          details: {
            workflowId,
            fieldId: field.id,
            fieldKey: field.key,
            operator,
            enabled,
            displayOrder,
          },
        });
      });
      return finish("Workflow condition saved.");
    }

    await db.$transaction(async (transaction) => {
      const condition = await transaction.crmWorkflowCondition.create({
        data: {
          crmInstanceId: tenant.crmId,
          moduleKey: workflow.moduleKey,
          workflowId: workflow.id,
          fieldId: field.id,
          operator: operator as CrmConditionalOperator,
          comparisonValue: normalizedComparison,
          enabled,
          displayOrder,
        },
        select: { id: true },
      });
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey: workflow.moduleKey,
        entityId: condition.id,
        action: "workflow_condition_added",
        actorUserId: tenant.userId,
        details: {
          workflowId,
          fieldId: field.id,
          fieldKey: field.key,
          operator,
          enabled,
          displayOrder,
        },
      });
    });
    return finish("Workflow condition added.");
  }, formData);
}

export async function deleteWorkflowCondition(
  _previous: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  return runAction(async (tenant) => {
    const conditionId = fieldValue(formData, "conditionId");
    if (!conditionId) throw new WorkflowInputError("Condition could not be identified.");
    const existing = await db.crmWorkflowCondition.findFirst({
      where: { id: conditionId, crmInstanceId: tenant.crmId },
      select: {
        id: true,
        moduleKey: true,
        workflowId: true,
        fieldId: true,
      },
    });
    if (!existing) throw new WorkflowInputError("Condition was not found in this CRM.");
    await db.$transaction(async (transaction) => {
      await transaction.crmWorkflowCondition.delete({ where: { id: existing.id } });
      await auditWorkflowChange({
        transaction,
        crmInstanceId: tenant.crmId,
        moduleKey: existing.moduleKey,
        entityId: existing.id,
        action: "workflow_condition_deleted",
        actorUserId: tenant.userId,
        details: { workflowId: existing.workflowId, fieldId: existing.fieldId },
      });
    });
    return finish("Workflow condition deleted.");
  }, formData);
}
