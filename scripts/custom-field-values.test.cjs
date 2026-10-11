/* eslint @typescript-eslint/no-require-imports: "off" */

const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
const originalLoad = Module._load;

const permissions = {
  COMPANIES_UPDATE: "companies:update",
  CONTACTS_UPDATE: "contacts:update",
  LEADS_UPDATE: "leads:update",
  TASKS_UPDATE: "tasks:update",
};

let tenant;
let deniedPermissions;
let permissionChecks;
let fields;
let records;
let values;
let corruptOptionFieldId;

class AuthorizationError extends Error {}

function makeField({
  id,
  crmInstanceId = "crm-a",
  moduleKey = "companies",
  fieldType = "TEXT",
  origin = "CUSTOM",
  enabled = true,
  required = false,
  maxLength = null,
  minValue = null,
  maxValue = null,
  pattern = null,
  options = [],
}) {
  return {
    id,
    crmInstanceId,
    moduleKey,
    key: id,
    label: id,
    fieldType,
    origin,
    required,
    enabled,
    minLength: null,
    maxLength,
    minValue,
    maxValue,
    pattern,
    moduleConfiguration: { enabled: true },
    options: options.map((option) => ({
      crmInstanceId,
      moduleKey,
      fieldId: id,
      enabled: true,
      ...option,
    })),
  };
}

function identityMatches(row, where) {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function setup() {
  tenant = { crmId: "crm-a", crmRole: "CRM_ADMIN" };
  deniedPermissions = new Set();
  permissionChecks = [];
  corruptOptionFieldId = null;
  fields = [
    makeField({ id: "company-text", maxLength: 8 }),
    makeField({ id: "company-limited", maxLength: 3 }),
    makeField({
      id: "company-number",
      fieldType: "NUMBER",
      minValue: 1,
      maxValue: 5,
    }),
    makeField({ id: "company-boolean", fieldType: "BOOLEAN" }),
    makeField({ id: "company-date", fieldType: "DATE" }),
    makeField({ id: "company-datetime", fieldType: "DATETIME" }),
    makeField({
      id: "company-select",
      fieldType: "SELECT",
      options: [
        { id: "enabled-option", key: "enabled", label: "Enabled" },
        { id: "disabled-option", key: "disabled", label: "Disabled", enabled: false },
      ],
    }),
    makeField({ id: "company-disabled", enabled: false }),
    makeField({ id: "system-field", origin: "SYSTEM" }),
    makeField({ id: "contact-text", moduleKey: "contacts" }),
    makeField({ id: "lead-text", moduleKey: "leads" }),
    makeField({ id: "task-text", moduleKey: "tasks" }),
    makeField({ id: "foreign-field", crmInstanceId: "crm-b" }),
  ];
  records = new Set([
    "companies:crm-a:company-a",
    "companies:crm-b:company-b",
    "contacts:crm-a:contact-a",
    "leads:crm-a:lead-a",
    "tasks:crm-a:task-a",
  ]);
  values = {
    companies: [],
    contacts: [],
    leads: [],
    tasks: [],
  };

  const fieldDelegate = {
    findMany: async ({ where }) =>
      fields.filter(
        (candidate) =>
          candidate.crmInstanceId === where.crmInstanceId &&
          candidate.moduleKey === where.moduleKey &&
          candidate.origin === where.origin &&
          candidate.enabled === where.enabled &&
          candidate.moduleConfiguration.enabled ===
            where.moduleConfiguration.enabled,
      ),
    findFirst: async ({ where }) => {
      const field = fields.find(
        (candidate) =>
          candidate.id === where.id &&
          candidate.crmInstanceId === where.crmInstanceId &&
          candidate.origin === where.origin &&
          (where.enabled === undefined ||
            candidate.enabled === where.enabled),
      );
      if (!field) return null;
      const selectedOptions = field.options.filter((option) => option.enabled);
      if (field.id === corruptOptionFieldId) {
        selectedOptions[0].crmInstanceId = "crm-b";
      }
      return { ...field, options: selectedOptions };
    },
  };

  const tx = {
    crmFieldDefinition: fieldDelegate,
    company: { findFirst: async ({ where }) => records.has(`companies:${where.crmInstanceId}:${where.id}`) ? { id: where.id } : null },
    contact: { findFirst: async ({ where }) => records.has(`contacts:${where.crmInstanceId}:${where.id}`) ? { id: where.id } : null },
    lead: { findFirst: async ({ where }) => records.has(`leads:${where.crmInstanceId}:${where.id}`) ? { id: where.id } : null },
    task: { findFirst: async ({ where }) => records.has(`tasks:${where.crmInstanceId}:${where.id}`) ? { id: where.id } : null },
  };

  for (const [moduleKey, delegate] of [
    ["companies", "customCompanyFieldValue"],
    ["contacts", "customContactFieldValue"],
    ["leads", "customLeadFieldValue"],
    ["tasks", "customTaskFieldValue"],
  ]) {
    tx[delegate] = {
      create: async ({ data }) => {
        if (values[moduleKey].some((row) => identityMatches(row, {
          crmInstanceId: data.crmInstanceId,
          moduleKey: data.moduleKey,
          recordId: data.recordId,
          fieldId: data.fieldId,
        }))) {
          throw new Error("unique constraint");
        }
        const row = { id: `value-${values[moduleKey].length + 1}`, ...data };
        values[moduleKey].push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }) => {
        const row = values[moduleKey].find((candidate) => identityMatches(candidate, where));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      upsert: async ({ where, create, update }) => {
        const identity = where.crmInstanceId_moduleKey_recordId_fieldId;
        let row = values[moduleKey].find((candidate) => identityMatches(candidate, identity));
        if (row) Object.assign(row, update);
        else {
          row = { id: `value-${values[moduleKey].length + 1}`, ...create };
          values[moduleKey].push(row);
        }
        return { id: row.id };
      },
      deleteMany: async ({ where }) => {
        const before = values[moduleKey].length;
        values[moduleKey] = values[moduleKey].filter((row) => !identityMatches(row, where));
        return { count: before - values[moduleKey].length };
      },
    };
  }

  const db = {
    crmFieldDefinition: fieldDelegate,
    $transaction: async (callback) => callback(tx),
  };

  Module._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    if (request === "@/lib/auth/errors") return { AuthorizationError };
    if (request === "@/lib/auth/authorization") {
      return {
        assertCrmRolePermission: async (role, permission) => {
          permissionChecks.push({ role, permission });
          if (deniedPermissions.has(permission)) {
            throw new AuthorizationError("Denied");
          }
        },
      };
    }
    if (request === "@/lib/crm/context") {
      return { getCrmTenantContext: async () => tenant };
    }
    if (request === "@/lib/crm/permissions") return { CRM_PERMISSIONS: permissions };
    if (request === "@/lib/crm/conditional-logic") {
      return require("../src/lib/crm/conditional-logic.ts");
    }
    if (request === "@/lib/crm/runtime-validation") {
      return require("../src/lib/crm/runtime-validation.ts");
    }
    if (request === "@/lib/db") return { db };
    return originalLoad.call(this, request, parent, isMain);
  };
}

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  module._compile(
    ts.transpile(source, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    }),
    filename,
  );
};

setup();
const service = require("../src/lib/crm/custom-field-values.ts");
const { CrmFieldType } = require("@prisma/client/index");

test("same-CRM custom value create validates and stores typed values", async () => {
  setup();
  const result = await service.createCustomFieldValue({
    recordId: "company-a",
    fieldId: "company-text",
    value: "hello",
  });
  assert.ok(result.id);
  assert.equal(values.companies[0].textValue, "hello");
  assert.equal(values.companies[0].fieldType, CrmFieldType.TEXT);
  assert.equal(values.companies[0].fieldOrigin, "CUSTOM");
  assert.equal(values.companies[0].crmInstanceId, "crm-a");
});

test("number, boolean, date, datetime, and SELECT use typed storage", async () => {
  setup();
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-number", value: "2.5" });
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-boolean", value: false });
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-date", value: "2026-10-04" });
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-datetime", value: "2026-10-04T12:30" });
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-select", value: "enabled" });
  assert.equal(values.companies[0].numberValue, 2.5);
  assert.equal(values.companies[1].booleanValue, false);
  assert.equal(values.companies[2].dateValue.toISOString(), "2026-10-04T00:00:00.000Z");
  assert.equal(values.companies[3].datetimeValue.toISOString(), "2026-10-04T12:30:00.000Z");
  assert.equal(values.companies[4].optionId, "enabled-option");
  assert.equal(values.companies[4].optionFieldId, "company-select");
});

test("foreign CRM fields, records, and cross-module records are rejected", async () => {
  setup();
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "foreign-field", value: "x" }));
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-b", fieldId: "company-text", value: "x" }));
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "contact-text", value: "x" }));
  assert.equal(values.companies.length + values.contacts.length, 0);
});

test("SYSTEM and disabled fields cannot be persisted", async () => {
  setup();
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "system-field", value: "x" }));
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-disabled", value: "x" }));
  assert.equal(values.companies.length, 0);
});

test("invalid text, number, boolean, date, datetime, and SELECT values are rejected", async () => {
  setup();
  const invalid = [
    ["company-limited", "long"],
    ["company-number", "0"],
    ["company-boolean", "sometimes"],
    ["company-date", "2026-02-30"],
    ["company-datetime", "not-a-date"],
    ["company-select", "unknown"],
    ["company-select", "disabled"],
  ];
  for (const [fieldId, value] of invalid) {
    await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId, value }));
  }
  assert.equal(values.companies.length, 0);
});

test("cross-CRM option association and users without UPDATE permission are rejected", async () => {
  setup();
  corruptOptionFieldId = "company-select";
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-select", value: "enabled" }));
  setup();
  tenant.crmRole = "CRM_MEMBER";
  deniedPermissions.add(permissions.COMPANIES_UPDATE);
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-text", value: "x" }));
  assert.deepEqual(permissionChecks.map((check) => check.permission), [permissions.COMPANIES_UPDATE]);
  assert.equal(values.companies.length, 0);
});

test("CRM_MEMBER cannot bypass ownership checks; duplicate record-field values are rejected", async () => {
  setup();
  tenant.crmRole = "CRM_MEMBER";
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-b", fieldId: "company-text", value: "x" }));
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-text", value: "one" });
  await assert.rejects(service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-text", value: "two" }));
  assert.equal(values.companies.length, 1);
});

test("update and delete scope by value, CRM, module, record, and field", async () => {
  setup();
  await service.createCustomFieldValue({ recordId: "company-a", fieldId: "company-text", value: "local" });
  values.companies.push({
    id: "foreign-value",
    crmInstanceId: "crm-b",
    moduleKey: "companies",
    recordId: "company-b",
    fieldId: "company-text",
    fieldType: "TEXT",
    fieldOrigin: "CUSTOM",
    textValue: "foreign",
  });
  await assert.rejects(service.updateCustomFieldValue({
    valueId: "foreign-value",
    recordId: "company-a",
    fieldId: "company-text",
    value: "tampered",
  }));
  await assert.rejects(service.deleteCustomFieldValue({
    valueId: "foreign-value",
    recordId: "company-a",
    fieldId: "company-text",
  }));
  assert.equal(values.companies.find((row) => row.id === "foreign-value").textValue, "foreign");
  const localId = values.companies.find((row) => row.crmInstanceId === "crm-a").id;
  await service.updateCustomFieldValue({
    valueId: localId,
    recordId: "company-a",
    fieldId: "company-text",
    value: "updated",
  });
  assert.equal(values.companies.find((row) => row.id === localId).textValue, "updated");
  await service.deleteCustomFieldValue({
    valueId: localId,
    recordId: "company-a",
    fieldId: "company-text",
  });
  assert.equal(values.companies.some((row) => row.id === localId), false);
});

test("upsert is idempotent and an empty optional value clears persisted data", async () => {
  setup();
  const first = await service.upsertCustomFieldValue({
    recordId: "company-a",
    fieldId: "company-text",
    value: "one",
  });
  const second = await service.upsertCustomFieldValue({
    recordId: "company-a",
    fieldId: "company-text",
    value: "two",
  });
  assert.equal(first.id, second.id);
  assert.equal(values.companies.length, 1);
  assert.equal(values.companies[0].textValue, "two");
  const cleared = await service.upsertCustomFieldValue({
    recordId: "company-a",
    fieldId: "company-text",
    value: "",
  });
  assert.equal(cleared.id, null);
  assert.equal(values.companies.length, 0);
});

test("operational conditional validation is enforced for Company, Contact, Lead, and Task", async () => {
  const modules = [
    ["companies", "company-text"],
    ["contacts", "contact-text"],
    ["leads", "lead-text"],
    ["tasks", "task-text"],
  ];

  for (const [moduleKey, targetId] of modules) {
    setup();
    const target = fields.find((field) => field.id === targetId);
    const systemSource = {
      id: `${moduleKey}-source`,
      key: "source",
      label: "Source",
      fieldType: "TEXT",
      origin: "SYSTEM",
      backingColumn: "source",
      required: false,
      displayOrder: 0,
      validation: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null },
      options: [],
    };
    const customTarget = {
      id: target.id,
      key: target.key,
      label: target.label,
      fieldType: target.fieldType,
      origin: "CUSTOM",
      backingColumn: null,
      required: false,
      displayOrder: 1,
      validation: { minLength: null, maxLength: null, minValue: null, maxValue: null, pattern: null },
      options: [],
    };
    const makeForm = (action) => ({
      key: `${moduleKey}_edit`,
      name: `${moduleKey} edit`,
      description: null,
      moduleKey,
      fields: [systemSource, customTarget],
      disabledFieldKeys: [],
      rules: [{
        sourceFieldKey: "source",
        sourceFieldType: "TEXT",
        operator: "EQUALS",
        comparisonValue: "referral",
        targetFieldKey: target.key,
        action,
        enabled: true,
      }],
    });

    const required = await service.resolveCustomFieldValuesForModule({
      tenant,
      moduleKey,
      formData: new FormData(),
      conditionalForm: makeForm("REQUIRE"),
      systemValues: { source: "referral" },
    });
    assert.equal(required.valid, false, `${moduleKey} requires the target`);
    assert.match(required.errors[target.key], /required/);

    for (const action of ["HIDE", "DISABLE"]) {
      const forged = new FormData();
      forged.append(`field:${target.key}`, "forged");
      const result = await service.resolveCustomFieldValuesForModule({
        tenant,
        moduleKey,
        formData: forged,
        conditionalForm: makeForm(action),
        systemValues: { source: "referral" },
      });
      assert.equal(result.valid, false, `${moduleKey} rejects ${action} value`);
      assert.match(result.errors[target.key], action === "HIDE" ? /hidden/ : /disabled/);
    }

    const noConfiguredForm = await service.resolveCustomFieldValuesForModule({
      tenant,
      moduleKey,
      formData: new FormData(),
    });
    assert.equal(noConfiguredForm.valid, true, `${moduleKey} preserves no-form behavior`);
  }
});

test("operational conditional validation fails closed for missing form fields", async () => {
  setup();
  const formData = new FormData();
  await assert.rejects(service.resolveCustomFieldValuesForModule({
    tenant,
    moduleKey: "companies",
    formData,
    conditionalForm: {
      key: "company_edit",
      name: "Company edit",
      description: null,
      moduleKey: "companies",
      fields: [],
      disabledFieldKeys: [],
      rules: [{
        sourceFieldKey: "missing-source",
        sourceFieldType: "TEXT",
        operator: "EQUALS",
        comparisonValue: "referral",
        targetFieldKey: "company-text",
        action: "REQUIRE",
        enabled: true,
      }],
    },
    systemValues: {},
  }), /outside the operational form/);
});
