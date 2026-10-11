/* eslint @typescript-eslint/no-require-imports: "off" */

const assert = require("node:assert/strict");
const test = require("node:test");
const harness = require("./workflows.test.cjs");
const { setup, db, workflows, actions, formData, evaluationWorkflow, setDenied } = harness;

function taskAction(overrides = {}) {
  return {
    id: "action-a",
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    workflowId: "workflow-a",
    actionType: "CREATE_TASK",
    enabled: true,
    displayOrder: 0,
    taskTitle: "Follow up",
    taskDescription: "Contact the lead",
    taskStatus: "TODO",
    taskPriority: "HIGH",
    taskDueDate: new Date("2026-10-10T00:00:00.000Z"),
    ...overrides,
  };
}

function matchedEvent(overrides = {}) {
  return {
    tenant: harness.state.tenant,
    moduleKey: "leads",
    eventType: "RECORD_UPDATED",
    recordId: "lead-a",
    eventId: "event-a",
    before: { recordId: "lead-a", revision: "before", values: {}, relatedRecordIds: { companyId: null, contactId: null, leadId: null } },
    after: { recordId: "lead-a", revision: "after", values: {}, relatedRecordIds: { companyId: null, contactId: null, leadId: null } },
    ...overrides,
  };
}

function setupMatched({ workflow = {}, action = {}, condition = [] } = {}) {
  setup();
  harness.state.workflows.push(evaluationWorkflow({
    id: "workflow-a",
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    triggerEvent: "RECORD_UPDATED",
    conditions: condition,
    ...workflow,
  }));
  harness.state.workflowActions.push(taskAction(action));
  harness.state.records.leads["lead-a"] = {
    id: "lead-a",
    crmInstanceId: "crm-a",
    updatedAt: new Date("2026-10-07T09:00:00.000Z"),
  };
}

test("CREATE_TASK configuration is CRM-scoped, validated, and audited", async () => {
  setup();
  harness.state.workflows.push(evaluationWorkflow({ id: "workflow-a", crmInstanceId: "crm-a" }));
  const saved = await actions.saveWorkflowAction({}, formData({
    workflowId: "workflow-a",
    taskTitle: "Follow up",
    taskDescription: "Call tomorrow",
    taskStatus: "IN_PROGRESS",
    taskPriority: "MEDIUM",
    taskDueDate: "2026-10-12",
    displayOrder: "2",
    enabled: "on",
  }));
  assert.deepEqual(saved, { success: "Task action added." });
  assert.equal(harness.state.workflowActions[0].crmInstanceId, "crm-a");
  assert.equal(harness.state.workflowActions[0].actionType, "CREATE_TASK");
  assert.equal(harness.state.workflowActions[0].taskTitle, "Follow up");
  assert.equal(harness.state.workflowActions[0].taskDueDate.toISOString(), "2026-10-12T00:00:00.000Z");
  assert.equal(harness.state.audit.at(-1).entityType, "crm_workflow_action");

  const invalid = await actions.saveWorkflowAction({}, formData({
    workflowId: "workflow-a",
    taskTitle: " ",
  }));
  assert.match(invalid.error, /Task title/);
  const invalidPriority = await actions.saveWorkflowAction({}, formData({
    workflowId: "workflow-a",
    taskTitle: "Follow up",
    taskPriority: "URGENT",
  }));
  assert.match(invalidPriority.error, /Task priority/);
  assert.equal(harness.state.workflowActions.length, 1);
});

test("foreign workflow and unauthorized action configuration are rejected", async () => {
  setup();
  harness.state.workflows.push(evaluationWorkflow({ id: "foreign", crmInstanceId: "crm-b" }));
  const foreign = await actions.saveWorkflowAction({}, formData({ workflowId: "foreign", taskTitle: "No" }));
  assert.match(foreign.error, /not found in this CRM/);
  setDenied(true);
  const unauthorized = await actions.saveWorkflowAction({}, formData({ workflowId: "foreign", taskTitle: "No" }));
  assert.match(unauthorized.error, /not authorized/);
  assert.equal(harness.state.workflowActions.length, 0);
  setDenied(false);
});

test("matched CREATE_TASK creates a same-CRM Task and atomically links a successful action run", async () => {
  setupMatched();
  await workflows.observeWorkflowEvent(matchedEvent());
  assert.equal(harness.state.tasks.length, 1);
  assert.equal(harness.state.tasks[0].crmInstanceId, "crm-a");
  assert.equal(harness.state.tasks[0].title, "Follow up");
  assert.equal(harness.state.tasks[0].description, "Contact the lead");
  assert.equal(harness.state.tasks[0].status, "TODO");
  assert.equal(harness.state.tasks[0].priority, "HIGH");
  assert.equal(harness.state.tasks[0].leadId, "lead-a");
  assert.equal(harness.state.workflowRuns[0].status, "MATCHED");
  assert.equal(harness.state.workflowActionRuns.length, 1);
  assert.equal(harness.state.workflowActionRuns[0].workflowRunId, harness.state.workflowRuns[0].id);
  assert.equal(harness.state.workflowActionRuns[0].workflowActionId, "action-a");
  assert.equal(harness.state.workflowActionRuns[0].status, "SUCCEEDED");
  assert.equal(harness.state.workflowActionRuns[0].createdTaskId, harness.state.tasks[0].id);
});

test("CREATE_TASK failure is recorded with a bounded error and does not escape observation", async () => {
  setupMatched();
  const originalTransaction = db.$transaction;
  const originalError = console.error;
  db.$transaction = async () => { throw new Error("x".repeat(5000)); };
  console.error = () => {};
  try {
    await assert.doesNotReject(workflows.observeWorkflowEvent(matchedEvent()));
  } finally {
    db.$transaction = originalTransaction;
    console.error = originalError;
  }
  assert.equal(harness.state.tasks.length, 0);
  assert.equal(harness.state.workflowActionRuns.length, 1);
  assert.equal(harness.state.workflowActionRuns[0].status, "FAILED");
  assert.ok(harness.state.workflowActionRuns[0].errorMessage.length <= 2000);
  assert.equal(harness.state.workflowActionRuns[0].createdTaskId, null);
});

test("Task creation permission is required and denied automation is recorded as failed", async () => {
  setupMatched();
  const originalError = console.error;
  console.error = () => {};
  setDenied(true);
  try {
    await workflows.observeWorkflowEvent(matchedEvent());
  } finally {
    setDenied(false);
    console.error = originalError;
  }
  assert.equal(harness.state.tasks.length, 0);
  assert.equal(harness.state.workflowActionRuns[0].status, "FAILED");
  assert.match(harness.state.workflowActionRuns[0].errorMessage, /not authorized/);
});

test("disabled workflow, disabled action, and non-matching workflow do not create Tasks", async () => {
  setupMatched({ workflow: { enabled: false } });
  await workflows.observeWorkflowEvent(matchedEvent());
  assert.equal(harness.state.tasks.length, 0);

  setupMatched({ action: { enabled: false } });
  await workflows.observeWorkflowEvent(matchedEvent());
  assert.equal(harness.state.tasks.length, 0);
  assert.equal(harness.state.workflowActionRuns.length, 0);

  setupMatched({ condition: [{
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
  }] });
  await workflows.observeWorkflowEvent(matchedEvent({ after: { ...matchedEvent().after, values: { status: "new" } } }));
  assert.equal(harness.state.workflowRuns[0].status, "NOT_MATCHED");
  assert.equal(harness.state.tasks.length, 0);
});

test("foreign CRM workflows and actions cannot execute in the active CRM", async () => {
  setupMatched();
  harness.state.workflows[0].crmInstanceId = "crm-b";
  await workflows.observeWorkflowEvent(matchedEvent());
  assert.equal(harness.state.tasks.length, 0);

  setupMatched({ action: { crmInstanceId: "crm-b" } });
  await workflows.observeWorkflowEvent(matchedEvent());
  assert.equal(harness.state.tasks.length, 0);
  assert.equal(harness.state.workflowActionRuns.length, 0);
});

test("foreign Task relationship IDs fail closed", async () => {
  setupMatched();
  harness.state.records.leads["lead-a"].crmInstanceId = "crm-b";
  const originalError = console.error;
  console.error = () => {};
  try {
    await workflows.observeWorkflowEvent(matchedEvent());
  } finally {
    console.error = originalError;
  }
  assert.equal(harness.state.tasks.length, 0);
  assert.equal(harness.state.workflowActionRuns[0].status, "FAILED");
  assert.equal(harness.state.workflowActionRuns[0].errorMessage, "A related CRM record is unavailable.");
});

test("duplicate observation reuses the action result and does not create another Task", async () => {
  setupMatched();
  const event = matchedEvent();
  await workflows.observeWorkflowEvent(event);
  await workflows.observeWorkflowEvent(event);
  assert.equal(harness.state.tasks.length, 1);
  assert.equal(harness.state.workflowActionRuns.length, 1);
  assert.equal(harness.state.workflowActionRuns[0].status, "SUCCEEDED");
});

test("enabled actions execute in display order and configuration errors persist as failed", async () => {
  setupMatched();
  harness.state.workflowActions[0].displayOrder = 3;
  harness.state.workflowActions.push(taskAction({ id: "action-first", taskTitle: "First", displayOrder: 1 }));
  const originalError = console.error;
  console.error = () => {};
  try {
    await workflows.observeWorkflowEvent(matchedEvent());
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(harness.state.tasks.map((task) => task.title), ["First", "Follow up"]);
  assert.equal(harness.state.workflowActionRuns.every((run) => run.status === "SUCCEEDED"), true);

  setupMatched({ action: { taskTitle: null } });
  console.error = () => {};
  try {
    await workflows.observeWorkflowEvent(matchedEvent());
  } finally {
    console.error = originalError;
  }
  assert.equal(harness.state.tasks.length, 0);
  assert.equal(harness.state.workflowActionRuns[0].status, "FAILED");
});

