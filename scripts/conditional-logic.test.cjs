/* eslint @typescript-eslint/no-require-imports: "off" */

const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const fs = require("node:fs");
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

const logic = require("../src/lib/crm/conditional-logic.ts");
const CrmFieldType = {
  TEXT: "TEXT",
  TEXTAREA: "TEXTAREA",
  NUMBER: "NUMBER",
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  DATE: "DATE",
  DATETIME: "DATETIME",
  BOOLEAN: "BOOLEAN",
  SELECT: "SELECT",
};

class AuthorizationError extends Error {}
class PrismaClientKnownRequestError extends Error {}

let tenant;
let denied;
let requestedPermissions;
let createdRules;
let updatedRules;
let deletedRuleFilters;

const sourceOptions = [
  { key: "referral", enabled: true },
  { key: "web", enabled: true },
  { key: "legacy", enabled: false },
];

const sourceField = {
  id: "source-a",
  key: "lead_source",
  crmInstanceId: "crm-a",
  moduleKey: "leads",
  fieldType: "SELECT",
  enabled: true,
  options: sourceOptions,
};

const targetField = {
  id: "target-a",
  key: "referrer_name",
  crmInstanceId: "crm-a",
  moduleKey: "leads",
  fieldType: "TEXT",
  enabled: true,
  options: [],
};

function resetMutationMocks() {
  tenant = { crmId: "crm-a", userId: "user-a", crmRole: "CRM_ADMIN" };
  denied = false;
  requestedPermissions = [];
  createdRules = [];
  updatedRules = [];
  deletedRuleFilters = [];
}

const db = {
  crmModuleConfiguration: {
    findUnique: async ({ where }) =>
      where.crmInstanceId_moduleKey.crmInstanceId === tenant.crmId &&
      where.crmInstanceId_moduleKey.moduleKey === "leads"
        ? { moduleKey: "leads" }
        : null,
  },
  crmForm: {
    findFirst: async ({ where }) => {
      if (
        where.id !== "form-a" ||
        where.crmInstanceId !== tenant.crmId ||
        where.moduleKey !== "leads"
      ) {
        return null;
      }
      return {
        id: "form-a",
        formFields: [
          { field: sourceField },
          { field: targetField },
          {
            field: {
              ...targetField,
              id: "system-target",
              key: "system_status",
              origin: "SYSTEM",
            },
          },
        ],
      };
    },
  },
  crmConditionalRule: {
    findFirst: async ({ where }) =>
      where.id === "rule-a" && where.crmInstanceId === tenant.crmId
        ? { id: "rule-a" }
        : null,
    create: async ({ data }) => {
      createdRules.push(data);
      return { id: "new-rule" };
    },
    update: async ({ where, data }) => {
      updatedRules.push({ where, data });
      return { id: where.id };
    },
    deleteMany: async ({ where }) => {
      deletedRuleFilters.push(where);
      return { count: where.id === "rule-a" && where.crmInstanceId === tenant.crmId ? 1 : 0 };
    },
  },
  crmConfigurationAuditLog: {
    create: async () => ({ id: "audit-a" }),
  },
};

const permissions = {
  FIELDS_MANAGE: "fields:manage",
  FORMS_MANAGE: "forms:manage",
};

Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@prisma/client/index") {
    return {
      CrmFieldOrigin: { SYSTEM: "SYSTEM", CUSTOM: "CUSTOM" },
      CrmFieldType,
      Prisma: { PrismaClientKnownRequestError },
    };
  }
  if (request === "next/cache") return { revalidatePath: () => {} };
  if (request === "@/lib/auth/errors") return { AuthorizationError };
  if (request === "@/lib/auth/authorization") return {};
  if (request === "@/lib/crm/conditional-logic") return logic;
  if (request === "@/lib/crm/context") {
    return {
      getCrmTenantContext: async (permission) => {
        requestedPermissions.push(permission);
        if (denied) throw new AuthorizationError("Denied");
        return tenant;
      },
    };
  }
  if (request === "@/lib/crm/permissions") {
    return { CRM_PERMISSIONS: permissions };
  }
  if (request === "@/lib/db") return { db };
  return originalLoad.call(this, request, parent, isMain);
};

const { validateCrmRuntimeForm } = require("../src/lib/crm/runtime-validation.ts");
const {
  normalizeRuntimeForm,
  RuntimeFormUnavailableError,
} = require("../src/lib/crm/runtime-forms.ts");
const actions = require("../src/app/(customer)/crm/configuration/actions.ts");

function rule(overrides = {}) {
  return {
    sourceFieldKey: "source",
    sourceFieldType: "TEXT",
    operator: "EQUALS",
    comparisonValue: "yes",
    targetFieldKey: "target",
    action: "SHOW",
    ...overrides,
  };
}

test("operators evaluate against exact values and empty input", () => {
  const fields = [
    { id: "s", key: "source", fieldType: "TEXT", required: false },
    { id: "t", key: "target", fieldType: "TEXT", required: false },
  ];
  assert.equal(
    logic.evaluateConditionalFieldStates(
      fields,
      [rule({ action: "HIDE" })],
      { source: "yes" },
    ).target.visible,
    false,
  );
  assert.equal(
    logic.evaluateConditionalFieldStates(
      fields,
      [rule({ operator: "NOT_EQUALS", action: "HIDE" })],
      { source: "no" },
    ).target.visible,
    false,
  );
  assert.equal(
    logic.evaluateConditionalFieldStates(
      fields,
      [rule({ operator: "IS_EMPTY", comparisonValue: null, action: "HIDE" })],
      { source: " " },
    ).target.visible,
    false,
  );
  assert.equal(
    logic.evaluateConditionalFieldStates(
      fields,
      [rule({ operator: "IS_NOT_EMPTY", comparisonValue: null, action: "HIDE" })],
      { source: "yes" },
    ).target.visible,
    false,
  );
});

test("rules handle SELECT keys, BOOLEAN, NUMBER, DATE, and DATETIME comparisons", () => {
  const makeFields = (fieldType) => [
    { id: "s", key: "source", fieldType, required: false },
    { id: "t", key: "target", fieldType: "TEXT", required: false },
  ];
  for (const [fieldType, currentValue, expected] of [
    ["SELECT", "referral", "referral"],
    ["BOOLEAN", false, "false"],
    ["NUMBER", "2.0", "2"],
    ["DATE", "2026-10-05", "2026-10-05"],
    ["DATETIME", "2026-10-05T10:15:00", "2026-10-05T10:15"],
  ]) {
    const states = logic.evaluateConditionalFieldStates(
      makeFields(fieldType),
      [rule({ sourceFieldType: fieldType, comparisonValue: expected, action: "DISABLE" })],
      { source: currentValue },
    );
    assert.equal(states.target.enabled, false, `${fieldType} comparison`);
  }
});

test("multiple rules apply deterministic visibility, enablement, and requiredness precedence", () => {
  const fields = [
    { id: "s", key: "source", fieldType: "TEXT", required: false },
    { id: "t", key: "target", fieldType: "TEXT", required: false },
    { id: "r", key: "schema_required", fieldType: "TEXT", required: true },
  ];
  const rules = [
    rule({ action: "SHOW" }),
    rule({ action: "HIDE" }),
    rule({ action: "ENABLE" }),
    rule({ action: "DISABLE" }),
    rule({ action: "REQUIRE" }),
    rule({ action: "OPTIONAL" }),
    rule({ targetFieldKey: "schema_required", action: "OPTIONAL" }),
  ];
  const states = logic.evaluateConditionalFieldStates(fields, rules, { source: "yes" });
  assert.equal(states.target.visible, false);
  assert.equal(states.target.enabled, false);
  assert.equal(states.target.required, false);
  assert.equal(states.target.conditionallyRequired, false);
  assert.equal(states.schema_required.required, true);

  const gatedRules = [
    rule({ action: "SHOW" }),
    rule({ action: "ENABLE" }),
  ];
  const gatedWhenFalse = logic.evaluateConditionalFieldStates(
    fields,
    gatedRules,
    { source: "no" },
  );
  assert.equal(gatedWhenFalse.target.visible, false);
  assert.equal(gatedWhenFalse.target.enabled, false);
  const gatedWhenTrue = logic.evaluateConditionalFieldStates(
    fields,
    gatedRules,
    { source: "yes" },
  );
  assert.equal(gatedWhenTrue.target.visible, true);
  assert.equal(gatedWhenTrue.target.enabled, true);
});

test("conditional validation requires values and rejects hidden or disabled submissions", () => {
  const form = {
    key: "lead_form",
    name: "Lead form",
    description: null,
    moduleKey: "leads",
    fields: [
      {
        id: "source",
        key: "source",
        label: "Source",
        fieldType: "SELECT",
        required: false,
        displayOrder: 0,
        validation: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null },
        options: [{ key: "referral", label: "Referral" }],
      },
      {
        id: "target",
        key: "target",
        label: "Referrer",
        fieldType: "TEXT",
        required: false,
        displayOrder: 1,
        validation: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null },
        options: [],
      },
      {
        id: "disabled",
        key: "disabled",
        label: "Disabled",
        fieldType: "TEXT",
        required: false,
        displayOrder: 2,
        validation: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null },
        options: [],
      },
    ],
    disabledFieldKeys: [],
    rules: [
      rule({
        sourceFieldKey: "source",
        sourceFieldType: "SELECT",
        comparisonValue: "referral",
        targetFieldKey: "target",
        action: "REQUIRE",
      }),
      rule({
        sourceFieldKey: "source",
        sourceFieldType: "SELECT",
        comparisonValue: "referral",
        targetFieldKey: "disabled",
        action: "DISABLE",
      }),
    ],
  };
  const missingRequired = validateCrmRuntimeForm(form, { source: "referral" });
  assert.equal(missingRequired.valid, false);
  assert.match(missingRequired.errors.target, /required/);
  const disabledTamper = validateCrmRuntimeForm(form, {
    source: "referral",
    target: "Somebody",
    disabled: "forged",
  });
  assert.match(disabledTamper.errors.disabled, /disabled/);
  const hiddenForm = {
    ...form,
    rules: [
      ...form.rules,
      rule({
        sourceFieldKey: "source",
        sourceFieldType: "SELECT",
        comparisonValue: "referral",
        targetFieldKey: "target",
        action: "HIDE",
      }),
    ],
  };
  const hiddenTamper = validateCrmRuntimeForm(hiddenForm, {
    source: "referral",
    target: "forged",
  });
  assert.match(hiddenTamper.errors.target, /hidden/);
});

test("rule-definition validation rejects cross-CRM, wrong-module, detached, disabled, and self fields", () => {
  const common = {
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    formFieldIds: ["source-a", "target-a"],
    sourceField,
    targetField,
    operator: "EQUALS",
    comparisonValue: "referral",
    action: "SHOW",
  };
  assert.equal(
    logic.validateConditionalRuleDefinition(common).comparisonValue,
    "referral",
  );
  assert.throws(
    () => logic.validateConditionalRuleDefinition({
      ...common,
      crmInstanceId: "crm-b",
    }),
    logic.ConditionalRuleValidationError,
  );
  assert.throws(
    () => logic.validateConditionalRuleDefinition({
      ...common,
      moduleKey: "contacts",
    }),
    logic.ConditionalRuleValidationError,
  );
  assert.throws(
    () => logic.validateConditionalRuleDefinition({
      ...common,
      formFieldIds: ["target-a"],
    }),
    /attached to this form/,
  );
  assert.throws(
    () => logic.validateConditionalRuleDefinition({
      ...common,
      sourceField: { ...sourceField, enabled: false },
    }),
    /must be enabled/,
  );
  assert.throws(
    () => logic.validateConditionalRuleDefinition({
      ...common,
      targetField: sourceField,
    }),
    /cannot control itself/,
  );
  assert.throws(
    () => logic.validateConditionalRuleDefinition({
      ...common,
      comparisonValue: "legacy",
    }),
    /enabled option/,
  );
});

test("runtime form resolution retains validated CRM-scoped rules only", () => {
  const runtimeSource = {
    ...sourceField,
    label: "Lead source",
    required: false,
    displayOrder: 0,
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null,
    pattern: null,
    options: sourceOptions.map((option, sortOrder) => ({
      ...option,
      crmInstanceId: "crm-a",
      moduleKey: "leads",
      fieldId: "source-a",
      label: option.key,
      sortOrder,
    })),
  };
  const runtimeTarget = {
    ...targetField,
    label: "Referrer name",
    required: false,
    displayOrder: 1,
    minLength: null,
    maxLength: null,
    minValue: null,
    maxValue: null,
    pattern: null,
    options: [],
  };
  const record = {
    crmInstanceId: "crm-a",
    moduleKey: "leads",
    enabled: true,
    forms: [{
      id: "form-a",
      key: "lead_form",
      name: "Lead form",
      description: null,
      enabled: true,
      conditionalRules: [{
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        formId: "form-a",
        sourceFieldId: "source-a",
        targetFieldId: "target-a",
        operator: "EQUALS",
        comparisonValue: "referral",
        action: "REQUIRE",
        enabled: true,
        sourceField: runtimeSource,
        targetField: runtimeTarget,
      }],
      formFields: [runtimeSource, runtimeTarget].map((field, displayOrder) => ({
        crmInstanceId: "crm-a",
        moduleKey: "leads",
        displayOrder,
        requiredOverride: null,
        field,
      })),
    }],
  };

  const form = normalizeRuntimeForm(record, "crm-a", "leads", "lead_form");
  assert.equal(form.rules.length, 1);
  assert.equal(form.rules[0].sourceFieldKey, "lead_source");
  assert.equal(form.rules[0].comparisonValue, "referral");

  const foreignRecord = structuredClone(record);
  foreignRecord.forms[0].conditionalRules[0].crmInstanceId = "crm-b";
  assert.throws(
    () => normalizeRuntimeForm(foreignRecord, "crm-a", "leads", "lead_form"),
    RuntimeFormUnavailableError,
  );
});

function makeRuleFormData(overrides = {}) {
  const data = new FormData();
  const values = {
    moduleKey: "leads",
    formId: "form-a",
    crmInstanceId: "crm-b",
    sourceFieldId: "source-a",
    targetFieldId: "target-a",
    operator: "EQUALS",
    comparisonValue: "referral",
    action: "SHOW",
    enabled: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("configuration creation scopes writes to active CRM and server-resolved field metadata", async () => {
  resetMutationMocks();
  const result = await actions.createConditionalRule({}, makeRuleFormData({
    origin: "SYSTEM",
    fieldType: "TEXT",
    sourceFieldKey: "forged_key",
  }));
  assert.equal(result.success, "Conditional rule created.");
  assert.equal(createdRules.length, 1);
  assert.equal(createdRules[0].crmInstanceId, "crm-a");
  assert.equal(createdRules[0].moduleKey, "leads");
  assert.equal(createdRules[0].sourceFieldId, "source-a");
  assert.equal(createdRules[0].comparisonValue, "referral");
  assert.deepEqual(requestedPermissions, [permissions.FORMS_MANAGE]);
});

test("configuration actions reject forged tenant, module, field, option, and unauthorized requests", async () => {
  resetMutationMocks();
  const crossCrm = await actions.createConditionalRule(
    {},
    makeRuleFormData({ formId: "foreign-form" }),
  );
  assert.ok(crossCrm.error);
  assert.equal(createdRules.length, 0);

  const wrongModule = await actions.createConditionalRule(
    {},
    makeRuleFormData({ moduleKey: "contacts" }),
  );
  assert.ok(wrongModule.error);
  assert.equal(createdRules.length, 0);

  const fakeSystemField = await actions.createConditionalRule(
    {},
    makeRuleFormData({ sourceFieldId: "system-field-from-another-form" }),
  );
  assert.ok(fakeSystemField.error);
  assert.equal(createdRules.length, 0);

  const invalidOption = await actions.createConditionalRule(
    {},
    makeRuleFormData({ comparisonValue: "legacy" }),
  );
  assert.match(invalidOption.error, /enabled option/);
  assert.equal(createdRules.length, 0);

  denied = true;
  const unauthorized = await actions.createConditionalRule({}, makeRuleFormData());
  assert.match(unauthorized.error, /not authorized/);
  assert.equal(createdRules.length, 0);
});

test("conditional rule updates and deletes stay CRM-scoped", async () => {
  resetMutationMocks();
  const updateFormData = makeRuleFormData({ ruleId: "rule-a", action: "REQUIRE" });
  const updated = await actions.updateConditionalRule({}, updateFormData);
  assert.equal(updated.success, "Conditional rule updated.");
  assert.equal(updatedRules[0].where.id, "rule-a");
  assert.equal(updatedRules[0].data.crmInstanceId, undefined);

  const foreignUpdate = await actions.updateConditionalRule(
    {},
    makeRuleFormData({ ruleId: "foreign-rule" }),
  );
  assert.ok(foreignUpdate.error);
  assert.equal(updatedRules.length, 1);

  const deleteFormData = makeRuleFormData({ ruleId: "foreign-rule" });
  const deleted = await actions.deleteConditionalRule({}, deleteFormData);
  assert.ok(deleted.error);
  assert.equal(deletedRuleFilters[0].crmInstanceId, "crm-a");
});
