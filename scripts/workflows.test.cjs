/* eslint @typescript-eslint/no-require-imports: "off" */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const originalLoad = Module._load;

require.extensions[".ts"] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  loadedModule._compile(
    ts.transpile(source, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    }),
    filename,
  );
};

class AuthorizationError extends Error {}
class PrismaClientKnownRequestError extends Error {}

const enums = {
  CrmConditionalOperator: {
    EQUALS: "EQUALS",
    NOT_EQUALS: "NOT_EQUALS",
    IS_EMPTY: "IS_EMPTY",
    IS_NOT_EMPTY: "IS_NOT_EMPTY",
  },
  CrmFieldOrigin: { SYSTEM: "SYSTEM", CUSTOM: "CUSTOM" },
  CrmFieldType: {
    TEXT: "TEXT",
    TEXTAREA: "TEXTAREA",
    NUMBER: "NUMBER",
    EMAIL: "EMAIL",
    PHONE: "PHONE",
    DATE: "DATE",
    DATETIME: "DATETIME",
    BOOLEAN: "BOOLEAN",
    SELECT: "SELECT",
  },
  CrmWorkflowEvent: {
    RECORD_CREATED: "RECORD_CREATED",
    RECORD_UPDATED: "RECORD_UPDATED",
    RECORD_DELETED: "RECORD_DELETED",
  },
  CrmWorkflowRunStatus: {
    MATCHED: "MATCHED",
    NOT_MATCHED: "NOT_MATCHED",
    EVALUATION_FAILED: "EVALUATION_FAILED",
  },
  CrmWorkflowActionType: { CREATE_TASK: "CREATE_TASK" },
  CrmWorkflowActionRunStatus: { SUCCEEDED: "SUCCEEDED", FAILED: "FAILED" },
};

let state;
const db = {
  crmModuleConfiguration: {
    findUnique: async ({ where }) =>
      state.modules.find(
        (row) =>
          row.crmInstanceId ===
            where.crmInstanceId_moduleKey.crmInstanceId &&
          row.moduleKey === where.crmInstanceId_moduleKey.moduleKey,
      ) ?? null,
  },
  crmFieldDefinition: {
    findFirst: async ({ where }) =>
      state.fields.find(
        (field) =>
          field.id === where.id &&
          field.crmInstanceId === where.crmInstanceId &&
          field.moduleKey === where.moduleKey &&
          field.enabled === where.enabled,
      ) ?? null,
    findMany: async ({ where }) =>
      state.snapshotFields.filter(
        (field) =>
          field.crmInstanceId === where.crmInstanceId &&
          field.moduleKey === where.moduleKey,
      ),
  },
  crmWorkflow: {
    findFirst: async ({ where }) =>
      state.workflows.find(
        (workflow) =>
          workflow.id === where.id &&
          workflow.crmInstanceId === where.crmInstanceId,
      ) ?? null,
    findMany: async ({ where }) => {
      state.workflowQueries.push(where);
      return state.workflows.filter(
        (workflow) =>
          workflow.crmInstanceId === where.crmInstanceId &&
          workflow.moduleKey === where.moduleKey &&
          workflow.enabled === where.enabled &&
          workflow.triggerEvent === where.triggerEvent,
      );
    },
    findFirst: async ({ where }) => state.workflows.find((workflow) =>
      workflow.id === where.id &&
      workflow.crmInstanceId === where.crmInstanceId &&
      (where.moduleKey === undefined || workflow.moduleKey === where.moduleKey) &&
      (where.enabled === undefined || workflow.enabled === where.enabled),
    ) ?? null,
  },
  crmWorkflowCondition: {
    findFirst: async ({ where }) =>
      state.conditions.find(
        (condition) =>
          condition.id === where.id &&
          condition.crmInstanceId === where.crmInstanceId &&
          (where.moduleKey === undefined ||
            condition.moduleKey === where.moduleKey) &&
          (where.workflowId === undefined ||
            condition.workflowId === where.workflowId),
      ) ?? null,
  },
  crmWorkflowRun: {
    findFirst: async ({ where }) => state.workflowRuns.find((run) =>
      run.id === where.id &&
      run.crmInstanceId === where.crmInstanceId &&
      run.moduleKey === where.moduleKey &&
      run.workflowId === where.workflowId &&
      run.status === where.status,
    ) ?? null,
    upsert: async ({ where, create, update }) => {
      const key = where.crmInstanceId_moduleKey_workflowId_eventId;
      let run = state.workflowRuns.find((candidate) =>
        candidate.crmInstanceId === key.crmInstanceId &&
        candidate.moduleKey === key.moduleKey &&
        candidate.workflowId === key.workflowId &&
        candidate.eventId === key.eventId,
      );
      if (run) Object.assign(run, update);
      else {
        run = { id: `workflow-run-${state.workflowRuns.length + 1}`, ...create };
        state.workflowRuns.push(run);
      }
      return { id: run.id };
    },
    createMany: async ({ data, skipDuplicates }) => {
      let count = 0;
      for (const row of data) {
        if (state.workflowRuns.some((run) =>
          run.crmInstanceId === row.crmInstanceId &&
          run.moduleKey === row.moduleKey &&
          run.workflowId === row.workflowId &&
          run.eventId === row.eventId,
        )) {
          if (skipDuplicates) continue;
          throw new Error("Duplicate workflow run");
        }
        state.workflowRuns.push({ id: `workflow-run-${state.workflowRuns.length + 1}`, ...row });
        count += 1;
      }
      return { count };
    },
  },
  crmWorkflowAction: {
    findMany: async ({ where }) => state.workflowActions
      .filter((action) => action.crmInstanceId === where.crmInstanceId && action.moduleKey === where.moduleKey && action.workflowId === where.workflowId && action.enabled === where.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id)),
    findFirst: async ({ where }) => state.workflowActions.find((action) => action.id === where.id && action.crmInstanceId === where.crmInstanceId && (where.moduleKey === undefined || action.moduleKey === where.moduleKey) && (where.workflowId === undefined || action.workflowId === where.workflowId)) ?? null,
  },
  crmWorkflowActionRun: {
    findUnique: async ({ where }) => {
      const key = where.crmInstanceId_moduleKey_workflowRunId_workflowActionId;
      return state.workflowActionRuns.find((run) => run.crmInstanceId === key.crmInstanceId && run.moduleKey === key.moduleKey && run.workflowRunId === key.workflowRunId && run.workflowActionId === key.workflowActionId) ?? null;
    },
    findFirst: async ({ where }) => state.workflowActionRuns.find((run) => run.crmInstanceId === where.crmInstanceId && run.createdTaskId === where.createdTaskId && run.status === where.status) ?? null,
    createMany: async ({ data, skipDuplicates }) => {
      let count = 0;
      for (const row of data) {
        const duplicate = state.workflowActionRuns.some((run) => run.crmInstanceId === row.crmInstanceId && run.moduleKey === row.moduleKey && run.workflowRunId === row.workflowRunId && run.workflowActionId === row.workflowActionId);
        if (duplicate && skipDuplicates) continue;
        if (duplicate) throw new Error("Duplicate action run");
        state.workflowActionRuns.push({ id: `action-run-${state.workflowActionRuns.length + 1}`, ...row });
        count += 1;
      }
      return { count };
    },
    count: async ({ where }) => state.workflowActionRuns.filter((run) => run.crmInstanceId === where.crmInstanceId && run.workflowActionId === where.workflowActionId).length,
  },
  crmConfigurationAuditLog: {
    create: async ({ data }) => {
      state.audit.push(data);
      return { id: `audit-${state.audit.length}` };
    },
    createMany: async ({ data }) => {
      state.audit.push(...data);
      return { count: data.length };
    },
  },
};
for (const [moduleKey, recordDelegate, customDelegate] of [
  ["companies", "company", "customCompanyFieldValue"],
  ["contacts", "contact", "customContactFieldValue"],
  ["leads", "lead", "customLeadFieldValue"],
  ["tasks", "task", "customTaskFieldValue"],
]) {
  db[recordDelegate] = {
    findFirst: async ({ where }) => {
      const record = state.records[moduleKey]?.[where.id] ?? null;
      return record?.crmInstanceId === where.crmInstanceId ? record : null;
    },
  };
  db[customDelegate] = {
    findMany: async ({ where }) =>
      (state.customValues[moduleKey] ?? [])
        .filter(
          (value) =>
            value.crmInstanceId === where.crmInstanceId &&
            value.moduleKey === where.moduleKey &&
            value.recordId === where.recordId,
        )
        .map((value) => ({
          ...value,
          option: value.option ?? null,
        })),
  };
}

const transaction = {
  crmWorkflow: {
    create: async ({ data }) => {
      const created = { id: `workflow-${state.workflows.length + 1}`, ...data, conditions: [] };
      state.workflows.push(created);
      return { id: created.id };
    },
    update: async ({ where, data }) => {
      const workflow = state.workflows.find((candidate) => candidate.id === where.id);
      Object.assign(workflow, data);
      return { ...workflow };
    },
    delete: async ({ where }) => {
      const index = state.workflows.findIndex((workflow) => workflow.id === where.id);
      if (index >= 0) state.workflows.splice(index, 1);
    },
  },
  crmWorkflowCondition: {
    create: async ({ data }) => {
      const created = { id: `condition-${state.conditions.length + 1}`, ...data };
      state.conditions.push(created);
      return { id: created.id };
    },
    update: async ({ where, data }) => {
      const condition = state.conditions.find((candidate) => candidate.id === where.id);
      Object.assign(condition, data);
      return condition;
    },
    delete: async ({ where }) => {
      const index = state.conditions.findIndex((condition) => condition.id === where.id);
      if (index >= 0) state.conditions.splice(index, 1);
    },
  },
  crmWorkflowAction: {
    findFirst: db.crmWorkflowAction.findFirst,
    create: async ({ data }) => {
      const action = { id: `workflow-action-${state.workflowActions.length + 1}`, ...data };
      state.workflowActions.push(action);
      return { id: action.id };
    },
    update: async ({ where, data }) => {
      const action = state.workflowActions.find((candidate) => candidate.id === where.id);
      Object.assign(action, data);
      return { id: action.id };
    },
    delete: async ({ where }) => {
      state.workflowActions = state.workflowActions.filter((action) => action.id !== where.id);
    },
  },
  crmWorkflowActionRun: {
    create: async ({ data }) => {
      const run = { id: `action-run-${state.workflowActionRuns.length + 1}`, ...data };
      state.workflowActionRuns.push(run);
      return run;
    },
  },
  task: {
    create: async ({ data }) => {
      const task = { id: `task-${state.tasks.length + 1}`, ...data };
      state.tasks.push(task);
        state.records.tasks ??= {};
        state.records.tasks[task.id] = {
          ...task,
          updatedAt: new Date("2026-10-07T09:00:00.000Z"),
        };
      return { id: task.id };
    },
  },
  crmConfigurationAuditLog: db.crmConfigurationAuditLog,
};
db.$transaction = async (callback) => callback(transaction);

let denied = false;
let permissionCalls;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@prisma/client/index") {
    return {
      ...enums,
      Prisma: {
        PrismaClientKnownRequestError,
        InputJsonObject: Object,
      },
    };
  }
  if (request === "next/cache") return { revalidatePath: () => {} };
  if (request === "@/lib/auth/errors") return { AuthorizationError };
  if (request === "@/lib/crm/context") {
    return {
      getCrmTenantContext: async (permission) => {
        permissionCalls.push(permission);
        if (denied) throw new AuthorizationError("Denied");
        return state.tenant;
      },
    };
  }
  if (request === "@/lib/db") return { db };
  if (request === "@/lib/crm/conditional-logic") {
    return require("../src/lib/crm/conditional-logic.ts");
  }
  if (request === "@/lib/crm/workflows") {
    return require("../src/lib/crm/workflows.ts");
  }
  if (request === "@/lib/crm/workflow-actions") {
    return require("../src/lib/crm/workflow-actions.ts");
  }
  if (request === "@/lib/crm/permissions") {
    return {
      CRM_PERMISSIONS: {
        WORKFLOWS_READ: "workflows:read",
        WORKFLOWS_MANAGE: "workflows:manage",
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

function setup() {
  denied = false;
  permissionCalls = [];
  state = {
    tenant: { crmId: "crm-a", userId: "user-a", crmRole: "CRM_ADMIN" },
    modules: [
      { crmInstanceId: "crm-a", moduleKey: "leads", enabled: true },
      { crmInstanceId: "crm-a", moduleKey: "tasks", enabled: true },
      { crmInstanceId: "crm-b", moduleKey: "leads", enabled: true },
    ],
    fields: [
      {
        id: "select-a",
        key: "lead_source",
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        fieldType: "SELECT",
        enabled: true,
        options: [
          { key: "referral", enabled: true },
          { key: "website", enabled: true },
        ],
      },
      {
        id: "amount-a",
        key: "amount",
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        fieldType: "NUMBER",
        enabled: true,
        options: [],
      },
      {
        id: "field-b",
        key: "other_source",
        crmInstanceId: "crm-b",
        moduleKey: "leads",
        fieldType: "TEXT",
        enabled: true,
        options: [],
      },
      {
        id: "task-title",
        key: "title",
        crmInstanceId: "crm-a",
        moduleKey: "tasks",
        fieldType: "TEXT",
        enabled: true,
        options: [],
      },
    ],
    workflows: [],
    conditions: [],
    workflowRuns: [],
    workflowActions: [],
    workflowActionRuns: [],
    tasks: [],
    audit: [],
    workflowQueries: [],
    records: {
      leads: {
        "lead-snapshot": {
          id: "lead-snapshot",
          crmInstanceId: "crm-a",
          updatedAt: new Date("2026-10-05T10:15:00.000Z"),
          source: "referral",
        },
      },
    },
    snapshotFields: [
      {
        id: "sys-source",
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        key: "lead_source",
        fieldType: "SELECT",
        origin: "SYSTEM",
        backingColumn: "source",
      },
      {
        id: "custom-segment",
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        key: "segment",
        fieldType: "SELECT",
        origin: "CUSTOM",
        backingColumn: null,
      },
      {
        id: "custom-amount",
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        key: "amount",
        fieldType: "NUMBER",
        origin: "CUSTOM",
        backingColumn: null,
      },
    ],
    customValues: {
      leads: [
        {
          crmInstanceId: "crm-a",
          moduleKey: "leads",
          recordId: "lead-snapshot",
          fieldId: "custom-segment",
          option: { key: "enterprise" },
          textValue: null,
          numberValue: null,
          booleanValue: null,
          dateValue: null,
          datetimeValue: null,
        },
        {
          crmInstanceId: "crm-a",
          moduleKey: "leads",
          recordId: "lead-snapshot",
          fieldId: "custom-amount",
          option: null,
          textValue: null,
          numberValue: 125,
          booleanValue: null,
          dateValue: null,
          datetimeValue: null,
        },
      ],
    },
  };
}

setup();
const workflows = require("../src/lib/crm/workflows.ts");
const actions = require("../src/app/(customer)/crm/configuration/workflows/actions.ts");
const logic = require("../src/lib/crm/conditional-logic.ts");

function formData(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function evaluationWorkflow(overrides = {}) {
  return {
    id: "w1",
    name: "Referral lead",
    moduleKey: "leads",
    triggerEvent: "RECORD_CREATED",
    enabled: true,
    displayOrder: 0,
    conditions: [
      {
        enabled: true,
        operator: "EQUALS",
        comparisonValue: "referral",
        field: {
          id: "source",
          key: "source",
          crmInstanceId: "crm-a",
          moduleKey: "leads",
          fieldType: "SELECT",
          enabled: true,
          options: [{ key: "referral", enabled: true }],
        },
      },
    ],
    ...overrides,
  };
}

test("evaluates CREATE, UPDATE, and DELETE triggers against event snapshots", () => {
  const workflow = evaluationWorkflow();
  for (const eventType of [
    "RECORD_CREATED",
    "RECORD_UPDATED",
    "RECORD_DELETED",
  ]) {
    const context = {
      crmId: "crm-a",
      moduleKey: "leads",
      recordId: "lead-a",
      eventType,
      before: eventType === "RECORD_CREATED" ? null : { source: "referral" },
      after: eventType === "RECORD_DELETED" ? null : { source: "referral" },
    };
    workflow.triggerEvent = eventType;
    assert.deepEqual(
      workflows.evaluateWorkflowMatches({ workflows: [workflow], context }),
      [{ workflowId: "w1", workflowName: "Referral lead", matched: true }],
    );
  }
});

test("all enabled conditions must match; disabled conditions do not constrain", () => {
  const workflow = evaluationWorkflow({
    conditions: [
      ...evaluationWorkflow().conditions,
      {
        enabled: true,
        operator: "EQUALS",
        comparisonValue: "qualified",
        field: {
          id: "status",
          key: "status",
          crmInstanceId: "crm-a",
          moduleKey: "leads",
          fieldType: "TEXT",
          enabled: true,
          options: [],
        },
      },
    ],
  });
  const context = {
    crmId: "crm-a",
    moduleKey: "leads",
    recordId: "lead-a",
    eventType: "RECORD_CREATED",
    before: null,
    after: { source: "referral", status: "new" },
  };
  assert.equal(
    workflows.evaluateWorkflowMatches({ workflows: [workflow], context })[0].matched,
    false,
  );
  workflow.conditions[1].enabled = false;
  assert.equal(
    workflows.evaluateWorkflowMatches({ workflows: [workflow], context })[0].matched,
    true,
  );
});

test("disabled workflows and mismatched CRM, module, and trigger are isolated", () => {
  const context = {
    crmId: "crm-a",
    moduleKey: "leads",
    recordId: "lead-a",
    eventType: "RECORD_CREATED",
    before: null,
    after: { source: "referral" },
  };
  const matches = workflows.evaluateWorkflowMatches({
    context,
    workflows: [
      evaluationWorkflow(),
      evaluationWorkflow({ id: "disabled", enabled: false }),
      evaluationWorkflow({ id: "task", moduleKey: "tasks" }),
      evaluationWorkflow({ id: "update", triggerEvent: "RECORD_UPDATED" }),
      evaluationWorkflow({
        id: "foreign-condition",
        conditions: [{
          ...evaluationWorkflow().conditions[0],
          field: {
            ...evaluationWorkflow().conditions[0].field,
            crmInstanceId: "crm-b",
          },
        }],
      }),
    ],
  });
  assert.deepEqual(matches, [
    { workflowId: "foreign-condition", workflowName: "Referral lead", matched: false },
    { workflowId: "w1", workflowName: "Referral lead", matched: true },
  ]);
});

test("condition evaluation shares stable-key and typed conditional comparison behavior", () => {
  for (const [fieldType, currentValue, comparisonValue] of [
    ["SELECT", "referral", "referral"],
    ["BOOLEAN", false, "false"],
    ["NUMBER", 2, "2.0"],
    ["DATE", "2026-10-05", "2026-10-05"],
    ["DATETIME", "2026-10-05T10:15:00", "2026-10-05T10:15"],
  ]) {
    const source = { key: "source", fieldType };
    assert.equal(
      logic.conditionalRuleMatches(
        {
          sourceFieldKey: "source",
          sourceFieldType: fieldType,
          operator: "EQUALS",
          comparisonValue,
          targetFieldKey: "x",
          action: "SHOW",
        },
        source,
        { source: currentValue },
      ),
      true,
      `${fieldType} values compare in canonical form`,
    );
  }
});

test("empty and NOT_EQUALS operators reuse conditional-rule semantics", () => {
  const field = { key: "source", fieldType: "TEXT" };
  const buildRule = (operator, comparisonValue) => ({
    sourceFieldKey: "source",
    sourceFieldType: "TEXT",
    operator,
    comparisonValue,
    targetFieldKey: "unused",
    action: "SHOW",
  });
  assert.equal(
    logic.conditionalRuleMatches(buildRule("NOT_EQUALS", "referral"), field, {
      source: "website",
    }),
    true,
  );
  assert.equal(
    logic.conditionalRuleMatches(buildRule("NOT_EQUALS", "referral"), field, {
      source: "referral",
    }),
    false,
  );
  assert.equal(
    logic.conditionalRuleMatches(buildRule("IS_EMPTY", null), field, {
      source: null,
    }),
    true,
  );
  assert.equal(
    logic.conditionalRuleMatches(buildRule("IS_NOT_EMPTY", null), field, {
      source: "value",
    }),
    true,
  );
});

test("no conditions match all events and no-match results are deterministic", () => {
  const context = {
    crmId: "crm-a",
    moduleKey: "leads",
    recordId: "lead-a",
    eventType: "RECORD_UPDATED",
    before: { source: "web" },
    after: { source: "web" },
  };
  const results = workflows.evaluateWorkflowMatches({
    context,
    workflows: [
      evaluationWorkflow({
        id: "unconditional",
        conditions: [],
        triggerEvent: "RECORD_UPDATED",
      }),
      evaluationWorkflow({ id: "mismatch", triggerEvent: "RECORD_UPDATED" }),
    ],
  });
  assert.deepEqual(results, [
    { workflowId: "mismatch", workflowName: "Referral lead", matched: false },
    { workflowId: "unconditional", workflowName: "Referral lead", matched: true },
  ]);
});

test("workflow creation is CRM-scoped, authorized, and audit logged", async () => {
  setup();
  const result = await actions.createWorkflow({}, formData({
    moduleKey: "leads",
    name: "Referral Lead",
    description: "Only referral leads",
    triggerEvent: "RECORD_CREATED",
    enabled: "on",
    displayOrder: "2",
  }));
  assert.deepEqual(result, { success: "Workflow created." });
  assert.equal(state.workflows[0].crmInstanceId, "crm-a");
  assert.equal(state.workflows[0].moduleKey, "leads");
  assert.equal(state.workflows[0].triggerEvent, "RECORD_CREATED");
  assert.equal(state.audit[0].action, "workflow_created");
  assert.equal(state.audit[0].crmInstanceId, "crm-a");
  assert.deepEqual(permissionCalls, ["workflows:manage"]);
});

test("unauthorized and unsupported workflow creation are rejected", async () => {
  setup();
  denied = true;
  const unauthorized = await actions.createWorkflow({}, formData({
    moduleKey: "leads",
    name: "No access",
    triggerEvent: "RECORD_CREATED",
  }));
  assert.match(unauthorized.error, /not authorized/);
  assert.equal(state.workflows.length, 0);

  denied = false;
  const forgedModule = await actions.createWorkflow({}, formData({
    moduleKey: "platform_users",
    name: "Cross scope",
    triggerEvent: "RECORD_CREATED",
  }));
  assert.match(forgedModule.error, /supported CRM module/);
  assert.equal(state.workflows.length, 0);
});

test("workflow updates, toggles, and deletes are scoped and audited", async () => {
  setup();
  state.workflows.push({
    id: "local",
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    name: "Before",
    enabled: true,
    conditions: [],
  });
  state.workflows.push({
    id: "foreign",
    crmInstanceId: "crm-b",
    moduleKey: "leads",
    name: "Foreign",
    enabled: true,
  });
  const forbidden = await actions.updateWorkflow({}, formData({
    workflowId: "foreign",
    name: "Tamper",
    enabled: "on",
  }));
  assert.match(forbidden.error, /not found/);
  assert.equal(state.workflows[1].name, "Foreign");

  const updated = await actions.updateWorkflow({}, formData({
    workflowId: "local",
    name: "After",
    displayOrder: "4",
  }));
  assert.deepEqual(updated, { success: "Workflow saved." });
  assert.equal(state.audit.at(-1).action, "workflow_disabled");
  assert.equal(state.workflows[0].enabled, false);

  const deleted = await actions.deleteWorkflow({}, formData({
    workflowId: "local",
  }));
  assert.deepEqual(deleted, { success: "Workflow deleted." });
  assert.equal(state.audit.at(-1).action, "workflow_deleted");
  assert.equal(state.workflows.some((workflow) => workflow.id === "local"), false);
});

test("condition creation validates same-module enabled field and stable SELECT key", async () => {
  setup();
  state.workflows.push({
    id: "local",
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    name: "Referral",
    enabled: true,
  });
  const invalidOption = await actions.saveWorkflowCondition({}, formData({
    workflowId: "local",
    fieldId: "select-a",
    operator: "EQUALS",
    comparisonValue: "Referral display text",
    enabled: "on",
  }));
  assert.match(invalidOption.error, /enabled option/);
  assert.equal(state.conditions.length, 0);

  const wrongModule = await actions.saveWorkflowCondition({}, formData({
    workflowId: "local",
    fieldId: "task-title",
    operator: "EQUALS",
    comparisonValue: "x",
    enabled: "on",
  }));
  assert.match(wrongModule.error, /not found or is disabled/);

  const created = await actions.saveWorkflowCondition({}, formData({
    workflowId: "local",
    fieldId: "select-a",
    operator: "EQUALS",
    comparisonValue: "referral",
    enabled: "on",
  }));
  assert.deepEqual(created, { success: "Workflow condition added." });
  assert.equal(state.conditions[0].comparisonValue, "referral");
  assert.equal(state.audit.at(-1).action, "workflow_condition_added");
});

test("condition update/delete enforce workflow ownership and audit both changes", async () => {
  setup();
  state.workflows.push({
    id: "local",
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    name: "Local",
    enabled: true,
  });
  state.workflows.push({
    id: "foreign-workflow",
    crmInstanceId: "crm-b",
    moduleKey: "leads",
    name: "Foreign",
    enabled: true,
  });
  state.conditions.push({
    id: "local-condition",
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    workflowId: "local",
    fieldId: "select-a",
    operator: "EQUALS",
    comparisonValue: "referral",
    enabled: true,
  });
  const forbidden = await actions.saveWorkflowCondition({}, formData({
    workflowId: "foreign-workflow",
    conditionId: "local-condition",
    fieldId: "select-a",
    operator: "EQUALS",
    comparisonValue: "website",
  }));
  assert.match(forbidden.error, /not found in this CRM/);
  assert.equal(state.conditions[0].comparisonValue, "referral");

  const updated = await actions.saveWorkflowCondition({}, formData({
    workflowId: "local",
    conditionId: "local-condition",
    fieldId: "select-a",
    operator: "EQUALS",
    comparisonValue: "website",
    enabled: "on",
  }));
  assert.deepEqual(updated, { success: "Workflow condition saved." });
  assert.equal(state.conditions[0].comparisonValue, "website");
  assert.equal(state.audit.at(-1).action, "workflow_condition_updated");

  const deleted = await actions.deleteWorkflowCondition({}, formData({
    conditionId: "local-condition",
  }));
  assert.deepEqual(deleted, { success: "Workflow condition deleted." });
  assert.equal(state.audit.at(-1).action, "workflow_condition_deleted");
  assert.equal(state.conditions.length, 0);
});

test("server evaluator queries only the active CRM/module/trigger and ignores disabled workflows", async () => {
  setup();
  state.workflows.push(
    evaluationWorkflow({
      crmInstanceId: "crm-a",
      moduleKey: "leads",
      triggerEvent: "RECORD_CREATED",
      enabled: true,
    }),
    evaluationWorkflow({
      id: "foreign",
      crmInstanceId: "crm-b",
      moduleKey: "leads",
      triggerEvent: "RECORD_CREATED",
      enabled: true,
    }),
    evaluationWorkflow({
      id: "off",
      crmInstanceId: "crm-a",
      moduleKey: "leads",
      triggerEvent: "RECORD_CREATED",
      enabled: false,
    }),
  );
  const result = await workflows.evaluateWorkflowEvent({
    crmId: "crm-a",
    moduleKey: "leads",
    recordId: "lead-a",
    eventType: "RECORD_CREATED",
    before: null,
    after: { source: "referral" },
  });
  assert.deepEqual(result.map((entry) => entry.matched), [true]);
  assert.deepEqual(state.workflowQueries[0], {
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    enabled: true,
    triggerEvent: "RECORD_CREATED",
    moduleConfiguration: { enabled: true },
  });
});

test("record snapshots resolve system and custom SELECT values by stable option key", async () => {
  setup();
  const snapshot = await workflows.captureWorkflowRecordSnapshot({
    tenant: state.tenant,
    moduleKey: "leads",
    recordId: "lead-snapshot",
  });
  assert.deepEqual(snapshot, {
    recordId: "lead-snapshot",
    revision: "2026-10-05T10:15:00.000Z",
    relatedRecordIds: { companyId: null, contactId: null, leadId: null },
    values: {
      lead_source: "referral",
      segment: "enterprise",
      amount: 125,
    },
  });
});

test("post-commit workflow observation logs matches and does not fail CRUD on evaluator errors", async () => {
  setup();
  state.workflows.push(
    evaluationWorkflow({ crmInstanceId: "crm-a" }),
  );
  const observed = [];
  const originalInfo = console.info;
  console.info = (_message, details) => observed.push(details);
  try {
    await workflows.observeWorkflowEvent({
      tenant: state.tenant,
      moduleKey: "leads",
      eventType: "RECORD_CREATED",
      recordId: "lead-a",
      before: null,
      after: { recordId: "lead-a", values: { source: "referral" } },
      eventId: "event-create-1",
    });
  } finally {
    console.info = originalInfo;
  }
  assert.deepEqual(observed[0].matches, [
    { workflowId: "w1", workflowName: "Referral lead" },
  ]);

  const originalFindMany = db.crmWorkflow.findMany;
  const originalError = console.error;
  let evaluationErrorLogged = false;
  db.crmWorkflow.findMany = async () => {
    throw new Error("database unavailable");
  };
  console.error = () => {
    evaluationErrorLogged = true;
  };
  try {
    await assert.doesNotReject(
      workflows.observeWorkflowEvent({
        tenant: state.tenant,
        moduleKey: "leads",
        eventType: "RECORD_CREATED",
        recordId: "lead-a",
        before: null,
        after: { recordId: "lead-a", values: { source: "referral" } },
        eventId: "event-create-failure",
      }),
    );
  } finally {
    db.crmWorkflow.findMany = originalFindMany;
    console.error = originalError;
  }
  assert.equal(evaluationErrorLogged, true);
});

test("all operational CRUD paths observe workflow decisions only after persisted mutations", () => {
  const actions = [
    ["companies", "createCompany", "RECORD_CREATED", "$transaction"],
    ["companies", "updateCompany", "RECORD_UPDATED", "$transaction"],
    ["companies", "deleteCompany", "RECORD_DELETED", "company.deleteMany"],
    ["contacts", "createContact", "RECORD_CREATED", "$transaction"],
    ["contacts", "updateContact", "RECORD_UPDATED", "$transaction"],
    ["contacts", "deleteContact", "RECORD_DELETED", "contact.delete"],
    ["leads", "createLead", "RECORD_CREATED", "$transaction"],
    ["leads", "updateLead", "RECORD_UPDATED", "$transaction"],
    ["leads", "deleteLead", "RECORD_DELETED", "lead.delete"],
    ["tasks", "createTask", "RECORD_CREATED", "$transaction"],
    ["tasks", "updateTask", "RECORD_UPDATED", "$transaction"],
    ["tasks", "deleteTask", "RECORD_DELETED", "task.deleteMany"],
  ];

  for (const [moduleKey, actionName, eventType, commitMarker] of actions) {
    const actionPath = path.join(
      __dirname,
      "..",
      "src",
      "app",
      "(customer)",
      "crm",
      moduleKey,
      "actions.ts",
    );
    const source = fs.readFileSync(actionPath, "utf8");
    const sourceFile = ts.createSourceFile(
      actionPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const declaration = sourceFile.statements.find(
      (statement) =>
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === actionName,
    );
    assert.ok(declaration, `${moduleKey}.${actionName} exists`);
    const body = source.slice(declaration.pos, declaration.end);
    const commitAt = body.indexOf(commitMarker);
    const observationAt = body.indexOf("observeWorkflowEvent({");
    assert.ok(commitAt >= 0, `${moduleKey}.${actionName} persists its record`);
    assert.ok(observationAt > commitAt, `${moduleKey}.${actionName} observes after commit`);
    assert.ok(
      body.slice(observationAt).includes(`eventType: "${eventType}"`),
      `${moduleKey}.${actionName} emits ${eventType}`,
    );
    assert.ok(
      body.slice(observationAt).includes("eventId: workflowEventId"),
      `${moduleKey}.${actionName} passes its observation identity`,
    );
  }
});

test("persists matched and not-matched workflow runs idempotently", async () => {
  setup();
  const matching = evaluationWorkflow({ crmInstanceId: "crm-a" });
  const nonMatching = evaluationWorkflow({
    id: "w2",
    name: "Other source",
    crmInstanceId: "crm-a",
    conditions: [{
      enabled: true,
      operator: "EQUALS",
      comparisonValue: "website",
      field: evaluationWorkflow().conditions[0].field,
    }],
  });
  state.workflows.push(matching, nonMatching);
  const observation = {
    tenant: state.tenant,
    moduleKey: "leads",
    eventType: "RECORD_CREATED",
    recordId: "lead-a",
    eventId: "event-one",
    before: null,
    after: { recordId: "lead-a", values: { source: "referral" } },
  };

  await workflows.observeWorkflowEvent(observation);
  await workflows.observeWorkflowEvent(observation);
  assert.deepEqual(
    state.workflowRuns.map(({ workflowId, status }) => ({ workflowId, status })),
    [
      { workflowId: "w1", status: "MATCHED" },
      { workflowId: "w2", status: "NOT_MATCHED" },
    ],
  );
  assert.equal(state.workflowRuns.length, 2);
  assert.equal(state.workflowRuns[0].crmInstanceId, "crm-a");
  assert.equal(state.workflowRuns[0].moduleKey, "leads");
  assert.equal(state.workflowRuns[0].recordId, "lead-a");
  assert.equal(state.workflowRuns[0].triggerEvent, "RECORD_CREATED");
});

test("persists EVALUATION_FAILED without propagating errors to CRUD", async () => {
  setup();
  const malformed = evaluationWorkflow({ crmInstanceId: "crm-a", conditions: null });
  state.workflows.push(malformed);
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(workflows.observeWorkflowEvent({
      tenant: state.tenant,
      moduleKey: "leads",
      eventType: "RECORD_CREATED",
      recordId: "lead-a",
      eventId: "event-failed",
      before: null,
      after: { recordId: "lead-a", values: { source: "referral" } },
    }));
  } finally {
    console.error = originalError;
  }
  assert.equal(state.workflowRuns.length, 1);
  assert.equal(state.workflowRuns[0].status, "EVALUATION_FAILED");
  assert.match(state.workflowRuns[0].evaluationError, /filter/);
});

test("persists create, update, and delete events using before values for delete", async () => {
  setup();
  state.workflows.push(
    evaluationWorkflow({ id: "created", triggerEvent: "RECORD_CREATED", crmInstanceId: "crm-a" }),
    evaluationWorkflow({ id: "updated", triggerEvent: "RECORD_UPDATED", crmInstanceId: "crm-a" }),
    evaluationWorkflow({ id: "deleted", triggerEvent: "RECORD_DELETED", crmInstanceId: "crm-a" }),
  );
  const base = {
    tenant: state.tenant,
    moduleKey: "leads",
    recordId: "lead-a",
  };
  for (const [eventType, eventId, before, after] of [
    ["RECORD_CREATED", "event-created", null, { recordId: "lead-a", values: { source: "referral" } }],
    ["RECORD_UPDATED", "event-updated", { recordId: "lead-a", values: { source: "referral" } }, { recordId: "lead-a", values: { source: "referral" } }],
    ["RECORD_DELETED", "event-deleted", { recordId: "lead-a", values: { source: "referral" } }, null],
  ]) {
    await workflows.observeWorkflowEvent({ ...base, eventType, eventId, before, after });
  }
  assert.deepEqual(
    state.workflowRuns.map(({ workflowId, triggerEvent, status }) => ({ workflowId, triggerEvent, status })),
    [
      { workflowId: "created", triggerEvent: "RECORD_CREATED", status: "MATCHED" },
      { workflowId: "updated", triggerEvent: "RECORD_UPDATED", status: "MATCHED" },
      { workflowId: "deleted", triggerEvent: "RECORD_DELETED", status: "MATCHED" },
    ],
  );
});

test("observation IDs are stable for one record revision and differ across revisions", () => {
  const observation = {
    moduleKey: "leads",
    recordId: "lead-a",
    eventType: "RECORD_UPDATED",
    snapshot: { recordId: "lead-a", revision: "2026-10-05T10:15:00.000Z", values: {} },
  };
  assert.equal(
    workflows.createWorkflowObservationId(observation),
    workflows.createWorkflowObservationId(observation),
  );
  assert.notEqual(
    workflows.createWorkflowObservationId(observation),
    workflows.createWorkflowObservationId({
      ...observation,
      snapshot: { ...observation.snapshot, revision: "2026-10-05T10:16:00.000Z" },
    }),
  );
  assert.equal(
    workflows.createWorkflowObservationId({ ...observation, snapshot: null }),
    workflows.createWorkflowObservationId({ ...observation, snapshot: null }),
  );
});

test("workflow run writes are limited to the active CRM, module, and workflow", async () => {
  setup();
  state.workflows.push(
    evaluationWorkflow({ id: "local", crmInstanceId: "crm-a", moduleKey: "leads" }),
    evaluationWorkflow({ id: "foreign", crmInstanceId: "crm-b", moduleKey: "leads" }),
    evaluationWorkflow({ id: "other-module", crmInstanceId: "crm-a", moduleKey: "tasks" }),
  );
  await workflows.observeWorkflowEvent({
    tenant: state.tenant,
    moduleKey: "leads",
    eventType: "RECORD_CREATED",
    recordId: "lead-a",
    eventId: "scope-event",
    before: null,
    after: { recordId: "lead-a", values: { source: "referral" } },
  });
  assert.deepEqual(state.workflowRuns.map((run) => run.workflowId), ["local"]);
  assert.equal(state.workflowRuns[0].crmInstanceId, "crm-a");
  assert.equal(state.workflowRuns[0].moduleKey, "leads");
});

module.exports = {
  setup,
  get state() { return state; },
  db,
  workflows,
  actions,
  formData,
  evaluationWorkflow,
  setDenied(value) { denied = value; },
};
