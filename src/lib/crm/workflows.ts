import "server-only";

import { createHash } from "node:crypto";
import {
  CrmConditionalOperator,
  CrmFieldOrigin,
  CrmFieldType,
  CrmWorkflowEvent,
  CrmWorkflowRunStatus,
  type CrmFieldDefinition,
} from "@prisma/client/index";
import {
  conditionalRuleMatches,
  type ConditionalRule,
  type ConditionalRuleFieldMetadata,
} from "@/lib/crm/conditional-logic";
import type { CrmTenantContext } from "@/lib/crm/context";
import { db } from "@/lib/db";
import { executeMatchedWorkflowActions } from "@/lib/crm/workflow-actions";

export const WORKFLOW_MODULES = [
  "companies",
  "contacts",
  "leads",
  "tasks",
] as const;

export type WorkflowModuleKey = (typeof WORKFLOW_MODULES)[number];
export type WorkflowEventType =
  | "RECORD_CREATED"
  | "RECORD_UPDATED"
  | "RECORD_DELETED";
export type WorkflowRecordValues = Record<string, unknown>;

export type WorkflowEvaluationContext = {
  crmId: string;
  moduleKey: WorkflowModuleKey;
  recordId: string;
  eventType: WorkflowEventType;
  before: WorkflowRecordValues | null;
  after: WorkflowRecordValues | null;
};

export type WorkflowMatch = {
  workflowId: string;
  workflowName: string;
  matched: boolean;
};

export type WorkflowRecordSnapshot = {
  recordId: string;
  revision: string;
  values: WorkflowRecordValues;
  relatedRecordIds: {
    companyId: string | null;
    contactId: string | null;
    leadId: string | null;
  };
};

export function createWorkflowObservationId({
  moduleKey,
  recordId,
  eventType,
  snapshot,
}: {
  moduleKey: WorkflowModuleKey;
  recordId: string;
  eventType: WorkflowEventType;
  snapshot: WorkflowRecordSnapshot | null;
}): string {
  const revision = snapshot?.revision ?? "snapshot-unavailable";
  return createHash("sha256")
    .update([moduleKey, recordId, eventType, revision].join("\0"))
    .digest("hex");
}

export class WorkflowConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowConfigurationError";
  }
}

const EVENT_TYPES: readonly WorkflowEventType[] = [
  CrmWorkflowEvent.RECORD_CREATED,
  CrmWorkflowEvent.RECORD_UPDATED,
  CrmWorkflowEvent.RECORD_DELETED,
];

const OPERATIONAL_COLUMNS: Readonly<
  Record<WorkflowModuleKey, readonly string[]>
> = {
  companies: ["name", "email", "phone", "website", "industry", "status"],
  contacts: ["firstName", "lastName", "email", "phone", "jobTitle", "status"],
  leads: [
    "firstName",
    "lastName",
    "email",
    "phone",
    "jobTitle",
    "source",
    "status",
  ],
  tasks: ["title", "description", "dueDate", "priority", "status"],
};

function asWorkflowModule(moduleKey: string): WorkflowModuleKey {
  if ((WORKFLOW_MODULES as readonly string[]).includes(moduleKey)) {
    return moduleKey as WorkflowModuleKey;
  }
  throw new WorkflowConfigurationError(
    "Workflows are not supported for this CRM module.",
  );
}

function normalizeRecordValue(
  fieldType: CrmFieldType,
  value: unknown,
): unknown {
  if (value === null || value === undefined) return null;
  if (fieldType === CrmFieldType.DATE && value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (fieldType === CrmFieldType.DATETIME && value instanceof Date) {
    return value.toISOString().slice(0, 16);
  }
  return value;
}

async function findOperationalRecord(
  moduleKey: WorkflowModuleKey,
  crmInstanceId: string,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  switch (moduleKey) {
    case "companies": {
      const record = await db.company.findFirst({
        where: { id: recordId, crmInstanceId },
      });
      return record ? { ...record } : null;
    }
    case "contacts": {
      const record = await db.contact.findFirst({
        where: { id: recordId, crmInstanceId },
      });
      return record ? { ...record } : null;
    }
    case "leads": {
      const record = await db.lead.findFirst({
        where: { id: recordId, crmInstanceId },
      });
      return record ? { ...record } : null;
    }
    case "tasks": {
      const record = await db.task.findFirst({
        where: { id: recordId, crmInstanceId },
      });
      return record ? { ...record } : null;
    }
  }
}

async function findPersistedCustomValues(
  moduleKey: WorkflowModuleKey,
  crmInstanceId: string,
  recordId: string,
): Promise<Map<string, unknown>> {
  const where = { crmInstanceId, moduleKey, recordId };
  const values: Array<{
    fieldId: string;
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    dateValue: Date | null;
    datetimeValue: Date | null;
    optionKey: string | null;
  }> = [];

  switch (moduleKey) {
    case "companies": {
      const rows = await db.customCompanyFieldValue.findMany({
        where,
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          option: { select: { key: true } },
        },
      });
      values.push(...rows.map((row) => ({ ...row, optionKey: row.option?.key ?? null })));
      break;
    }
    case "contacts": {
      const rows = await db.customContactFieldValue.findMany({
        where,
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          option: { select: { key: true } },
        },
      });
      values.push(...rows.map((row) => ({ ...row, optionKey: row.option?.key ?? null })));
      break;
    }
    case "leads": {
      const rows = await db.customLeadFieldValue.findMany({
        where,
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          option: { select: { key: true } },
        },
      });
      values.push(...rows.map((row) => ({ ...row, optionKey: row.option?.key ?? null })));
      break;
    }
    case "tasks": {
      const rows = await db.customTaskFieldValue.findMany({
        where,
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          option: { select: { key: true } },
        },
      });
      values.push(...rows.map((row) => ({ ...row, optionKey: row.option?.key ?? null })));
      break;
    }
  }

  return new Map(
    values.map((value) => {
      const resolved =
        value.optionKey ??
        value.textValue ??
        value.numberValue ??
        value.booleanValue ??
        value.dateValue ??
        value.datetimeValue;
      return [value.fieldId, resolved];
    }),
  );
}

export async function captureWorkflowRecordSnapshot({
  tenant,
  moduleKey,
  recordId,
}: {
  tenant: CrmTenantContext;
  moduleKey: string;
  recordId: string;
}): Promise<WorkflowRecordSnapshot> {
  const normalizedModule = asWorkflowModule(moduleKey);
  if (!recordId) {
    throw new WorkflowConfigurationError("A record ID is required.");
  }
  const [record, fields, customValues] = await Promise.all([
    findOperationalRecord(normalizedModule, tenant.crmId, recordId),
    db.crmFieldDefinition.findMany({
      where: {
        crmInstanceId: tenant.crmId,
        moduleKey: normalizedModule,
        moduleConfiguration: { enabled: true },
      },
      select: {
        id: true,
        crmInstanceId: true,
        key: true,
        moduleKey: true,
        fieldType: true,
        origin: true,
        backingColumn: true,
      },
    }),
    findPersistedCustomValues(normalizedModule, tenant.crmId, recordId),
  ]);
  if (!record) {
    throw new WorkflowConfigurationError(
      "The CRM record could not be resolved for workflow evaluation.",
    );
  }

  const values: WorkflowRecordValues = {};
  for (const field of fields) {
    if (field.crmInstanceId !== tenant.crmId || field.moduleKey !== normalizedModule) {
      throw new WorkflowConfigurationError(
        "A workflow field is outside the active CRM module.",
      );
    }
    if (field.origin === CrmFieldOrigin.SYSTEM) {
      if (
        !field.backingColumn ||
        !OPERATIONAL_COLUMNS[normalizedModule].includes(field.backingColumn) ||
        !Object.prototype.hasOwnProperty.call(record, field.backingColumn)
      ) {
        continue;
      }
      values[field.key] = normalizeRecordValue(
        field.fieldType,
        record[field.backingColumn],
      );
    } else if (customValues.has(field.id)) {
      values[field.key] = normalizeRecordValue(
        field.fieldType,
        customValues.get(field.id),
      );
    } else {
      values[field.key] = null;
    }
  }
  const updatedAt = record.updatedAt;
  const revision = updatedAt instanceof Date
    ? updatedAt.toISOString()
    : String(updatedAt ?? "");
  if (!revision) {
    throw new WorkflowConfigurationError(
      "The CRM record revision could not be resolved for workflow evaluation.",
    );
  }
  return {
    recordId,
    revision,
    values,
    relatedRecordIds: {
      companyId: typeof record.companyId === "string" ? record.companyId : null,
      contactId: typeof record.contactId === "string" ? record.contactId : null,
      leadId: typeof record.leadId === "string" ? record.leadId : null,
    },
  };
}

export function evaluateWorkflowMatches({
  workflows,
  context,
}: {
  workflows: readonly {
    id: string;
    name: string;
    moduleKey: string;
    triggerEvent: WorkflowEventType;
    enabled: boolean;
    displayOrder: number;
    conditions: readonly {
      enabled: boolean;
      operator: CrmConditionalOperator;
      comparisonValue: string | null;
      field: {
        id: string;
        key: string;
        crmInstanceId: string;
        moduleKey: string;
        fieldType: CrmFieldType;
        enabled: boolean;
        options: { key: string; enabled: boolean }[];
      };
    }[];
  }[];
  context: WorkflowEvaluationContext;
}): WorkflowMatch[] {
  const values =
    context.eventType === CrmWorkflowEvent.RECORD_DELETED
      ? context.before
      : context.after;
  if (!values) return [];

  return [...workflows]
    .filter(
      (workflow) =>
        workflow.enabled &&
        workflow.moduleKey === context.moduleKey &&
        workflow.triggerEvent === context.eventType,
    )
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    )
    .map((workflow) => {
      const enabledConditions = workflow.conditions.filter(
        (condition) => condition.enabled,
      );
      const matched = enabledConditions.every((condition) => {
        const field = condition.field;
        if (
          !field.enabled ||
          field.crmInstanceId !== context.crmId ||
          field.moduleKey !== context.moduleKey
        ) {
          return false;
        }
        if (
          (field.fieldType === CrmFieldType.SELECT &&
            condition.comparisonValue !== null &&
            !field.options.some(
              (option) =>
                option.enabled && option.key === condition.comparisonValue,
            ))
        ) {
          return false;
        }
        const rule: ConditionalRule = {
          sourceFieldKey: field.key,
          sourceFieldType: field.fieldType,
          operator: condition.operator,
          comparisonValue: condition.comparisonValue,
          targetFieldKey: field.key,
          action: "SHOW",
          enabled: true,
        };
        return conditionalRuleMatches(rule, field, values);
      });
      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        matched,
      };
    });
}

export async function evaluateWorkflowEvent(
  context: WorkflowEvaluationContext,
): Promise<WorkflowMatch[]> {
  const moduleKey = asWorkflowModule(context.moduleKey);
  if (!EVENT_TYPES.includes(context.eventType)) {
    throw new WorkflowConfigurationError("Unsupported workflow event.");
  }
  const workflows = await db.crmWorkflow.findMany({
    where: {
      crmInstanceId: context.crmId,
      moduleKey,
      enabled: true,
      triggerEvent: context.eventType,
      moduleConfiguration: { enabled: true },
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      moduleKey: true,
      triggerEvent: true,
      enabled: true,
      displayOrder: true,
      conditions: {
        where: { enabled: true },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: {
          enabled: true,
          operator: true,
          comparisonValue: true,
          field: {
            select: {
              id: true,
              key: true,
              crmInstanceId: true,
              moduleKey: true,
              fieldType: true,
              enabled: true,
              options: { select: { key: true, enabled: true } },
            },
          },
        },
      },
    },
  });
  return evaluateWorkflowMatches({ workflows, context });
}

export async function captureWorkflowRecordSnapshotSafely(args: {
  tenant: CrmTenantContext;
  moduleKey: WorkflowModuleKey;
  recordId: string;
}): Promise<WorkflowRecordSnapshot | null> {
  try {
    return await captureWorkflowRecordSnapshot(args);
  } catch (error) {
    console.error("CRM workflow record snapshot failed.", {
      crmInstanceId: args.tenant.crmId,
      moduleKey: args.moduleKey,
      recordId: args.recordId,
      error,
    });
    return null;
  }
}

export async function observeWorkflowEvent({
  tenant,
  moduleKey,
  eventType,
  recordId,
  eventId,
  suppressActions = false,
  before,
  after,
}: {
  tenant: CrmTenantContext;
  moduleKey: WorkflowModuleKey;
  eventType: WorkflowEventType;
  recordId: string;
  eventId: string;
  suppressActions?: boolean;
  before: WorkflowRecordSnapshot | null;
  after: WorkflowRecordSnapshot | null;
}): Promise<void> {
  let matches: WorkflowMatch[];
  try {
    if (
      (eventType === CrmWorkflowEvent.RECORD_CREATED && (!after || before)) ||
      (eventType === CrmWorkflowEvent.RECORD_UPDATED && (!before || !after)) ||
      (eventType === CrmWorkflowEvent.RECORD_DELETED && (!before || after))
    ) {
      throw new WorkflowConfigurationError(
        "Workflow event snapshots do not match the event operation.",
      );
    }
    matches = await evaluateWorkflowEvent({
      crmId: tenant.crmId,
      moduleKey,
      recordId,
      eventType,
      before: before?.values ?? null,
      after: after?.values ?? null,
    });
  } catch (error) {
    try {
      const affectedWorkflows = await db.crmWorkflow.findMany({
        where: {
          crmInstanceId: tenant.crmId,
          moduleKey,
          enabled: true,
          triggerEvent: eventType,
          moduleConfiguration: { enabled: true },
        },
        select: { id: true },
      });
      const errorMessage = (error instanceof Error ? error.message : String(error))
        .slice(0, 2000);
      await db.crmWorkflowRun.createMany({
        data: affectedWorkflows.map((workflow) => ({
          crmInstanceId: tenant.crmId,
          moduleKey,
          workflowId: workflow.id,
          eventId,
          recordId,
          triggerEvent: eventType,
          status: CrmWorkflowRunStatus.EVALUATION_FAILED,
          evaluationError: errorMessage,
        })),
        skipDuplicates: true,
      });
    } catch (persistenceError) {
      console.error("CRM workflow failure could not be persisted.", {
        crmInstanceId: tenant.crmId,
        moduleKey,
        recordId,
        eventType,
        error: persistenceError,
      });
    }
    console.error("CRM workflow evaluation failed after committed CRUD.", {
      crmInstanceId: tenant.crmId,
      moduleKey,
      recordId,
      eventType,
      error,
    });
    return;
  }

  try {
    for (const match of matches) {
      const status = match.matched
        ? CrmWorkflowRunStatus.MATCHED
        : CrmWorkflowRunStatus.NOT_MATCHED;
      const run = await db.crmWorkflowRun.upsert({
        where: {
          crmInstanceId_moduleKey_workflowId_eventId: {
            crmInstanceId: tenant.crmId,
            moduleKey,
            workflowId: match.workflowId,
            eventId,
          },
        },
        create: {
          crmInstanceId: tenant.crmId,
          moduleKey,
          workflowId: match.workflowId,
          eventId,
          recordId,
          triggerEvent: eventType,
          status,
          evaluationError: null,
        },
        update: { status, evaluationError: null },
        select: { id: true },
      });
      if (match.matched && !suppressActions) {
        try {
          const actionResults = await executeMatchedWorkflowActions({
            tenant,
            workflowRunId: run.id,
            workflowId: match.workflowId,
            moduleKey,
            eventType,
            recordId,
            snapshot: eventType === CrmWorkflowEvent.RECORD_DELETED
              ? before!
              : after!,
          });
          for (const actionResult of actionResults) {
            if (actionResult.status !== "SUCCEEDED" || !actionResult.createdTaskId) continue;
            const taskSnapshot = await captureWorkflowRecordSnapshotSafely({
              tenant,
              moduleKey: "tasks",
              recordId: actionResult.createdTaskId,
            });
            const taskEventId = createWorkflowObservationId({
              moduleKey: "tasks",
              recordId: actionResult.createdTaskId,
              eventType: CrmWorkflowEvent.RECORD_CREATED,
              snapshot: taskSnapshot,
            });
            await observeWorkflowEvent({
              tenant,
              moduleKey: "tasks",
              eventType: CrmWorkflowEvent.RECORD_CREATED,
              recordId: actionResult.createdTaskId,
              eventId: taskEventId,
              before: null,
              after: taskSnapshot,
              suppressActions: true,
            });
          }
        } catch (actionError) {
          console.error("CRM workflow actions failed after committed CRUD.", {
            crmInstanceId: tenant.crmId,
            moduleKey,
            workflowId: match.workflowId,
            workflowRunId: run.id,
            recordId,
            eventType,
            errorName: actionError instanceof Error ? actionError.name : "UnknownError",
          });
        }
      }
    }
    console.info("CRM workflow decision evaluated.", {
      crmInstanceId: tenant.crmId,
      moduleKey,
      recordId,
      eventType,
      matches: matches.filter((match) => match.matched).map(({ workflowId, workflowName }) => ({
        workflowId,
        workflowName,
      })),
    });
  } catch (error) {
    console.error("CRM workflow decision could not be persisted after committed CRUD.", {
      crmInstanceId: tenant.crmId,
      moduleKey,
      recordId,
      eventType,
      error,
    });
  }
}

export function isWorkflowEventType(value: string): value is WorkflowEventType {
  return EVENT_TYPES.includes(value as WorkflowEventType);
}

export function workflowFieldMetadata(
  field: Pick<
    CrmFieldDefinition,
    "id" | "key" | "crmInstanceId" | "moduleKey" | "fieldType" | "enabled"
  > & { options: { key: string; enabled: boolean }[] },
): ConditionalRuleFieldMetadata {
  return {
    id: field.id,
    key: field.key,
    crmInstanceId: field.crmInstanceId,
    moduleKey: field.moduleKey,
    fieldType: field.fieldType,
    enabled: field.enabled,
    options: field.options,
  };
}
