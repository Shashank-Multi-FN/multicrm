import "server-only";

import type { CrmFieldOrigin, CrmFieldType } from "@prisma/client/index";
import { assertCrmRolePermission } from "@/lib/auth/authorization";
import {
  ConditionalRuleValidationError,
  type ConditionalRule,
  validateConditionalRuleDefinition,
} from "@/lib/crm/conditional-logic";
import type { CrmTenantContext } from "@/lib/crm/context";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { db } from "@/lib/db";

export type RuntimeFormOption = {
  key: string;
  label: string;
};

export type RuntimeFormField = {
  id: string;
  key: string;
  label: string;
  fieldType: CrmFieldType;
  origin: CrmFieldOrigin;
  backingColumn: string | null;
  required: boolean;
  displayOrder: number;
  validation: {
    minLength: number | null;
    maxLength: number | null;
    minValue: number | null;
    maxValue: number | null;
    pattern: string | null;
  };
  options: RuntimeFormOption[];
};

export type RuntimeForm = {
  key: string;
  name: string;
  description: string | null;
  moduleKey: string;
  fields: RuntimeFormField[];
  conditionFields?: RuntimeFormField[];
  disabledFieldKeys: string[];
  rules: ConditionalRule[];
};

export class RuntimeFormUnavailableError extends Error {}

type RuntimeFormRecord = {
  crmInstanceId: string;
  moduleKey: string;
  enabled: boolean;
  forms: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    conditionalRules: {
      crmInstanceId: string;
      moduleKey: string;
      formId: string;
      sourceFieldId: string;
      targetFieldId: string;
      operator: ConditionalRule["operator"];
      comparisonValue: string | null;
      action: ConditionalRule["action"];
      enabled: boolean;
      sourceField: {
        id: string;
        crmInstanceId: string;
        moduleKey: string;
        key: string;
        fieldType: CrmFieldType;
        enabled: boolean;
        options: { key: string; enabled: boolean }[];
      };
      targetField: {
        id: string;
        crmInstanceId: string;
        moduleKey: string;
        key: string;
        fieldType: CrmFieldType;
        enabled: boolean;
        options: { key: string; enabled: boolean }[];
      };
    }[];
    formFields: {
      crmInstanceId: string;
      moduleKey: string;
      displayOrder: number;
      requiredOverride: boolean | null;
      field: {
        id: string;
        crmInstanceId: string;
        moduleKey: string;
        key: string;
        label: string;
        fieldType: CrmFieldType;
        origin: CrmFieldOrigin;
        backingColumn: string | null;
        required: boolean;
        enabled: boolean;
        displayOrder: number;
        minLength: number | null;
        maxLength: number | null;
        minValue: number | null;
        maxValue: number | null;
        pattern: string | null;
        options: {
          crmInstanceId: string;
          moduleKey: string;
          fieldId: string;
          key: string;
          label: string;
          enabled: boolean;
          sortOrder: number;
        }[];
      };
    }[];
  }[];
};

export function normalizeRuntimeForm(
  record: RuntimeFormRecord | null,
  crmInstanceId: string,
  moduleKey: string,
  formKey: string,
): RuntimeForm {
  if (
    !record ||
    record.crmInstanceId !== crmInstanceId ||
    record.moduleKey !== moduleKey ||
    !record.enabled
  ) {
    throw new RuntimeFormUnavailableError("CRM module is not available.");
  }

  const form = record.forms.find((candidate) => candidate.key === formKey);
  if (!form || !form.enabled) {
    throw new RuntimeFormUnavailableError("CRM form is not available.");
  }

  const orderedRows = [...form.formFields].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      left.field.key.localeCompare(right.field.key),
  );
  const disabledFieldKeys: string[] = [];
  const fields: RuntimeFormField[] = [];

  for (const row of orderedRows) {
    const field = row.field;
    if (
      row.crmInstanceId !== crmInstanceId ||
      row.moduleKey !== moduleKey ||
      field.crmInstanceId !== crmInstanceId ||
      field.moduleKey !== moduleKey
    ) {
      throw new RuntimeFormUnavailableError(
        "CRM form contains a field outside its tenant or module.",
      );
    }
    if (!field.enabled) {
      disabledFieldKeys.push(field.key);
      continue;
    }

    if (
      field.options.some(
        (option) =>
          option.crmInstanceId !== crmInstanceId ||
          option.moduleKey !== moduleKey ||
          option.fieldId !== field.id,
      )
    ) {
      throw new RuntimeFormUnavailableError(
        "CRM form contains a SELECT option outside its field tenant or module.",
      );
    }
    const options = field.options
      .filter((option) => option.enabled)
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.key.localeCompare(right.key),
      )
      .map(({ key, label }) => ({ key, label }));

    fields.push({
      id: field.id,
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      origin: field.origin,
      backingColumn: field.backingColumn,
      required: row.requiredOverride ?? field.required,
      displayOrder: row.displayOrder,
      validation: {
        minLength: field.minLength,
        maxLength: field.maxLength,
        minValue: field.minValue,
        maxValue: field.maxValue,
        pattern: field.pattern,
      },
      options,
    });
  }

  const formFieldIds = orderedRows.map((row) => row.field.id);
  const activeFieldIds = new Set(fields.map((field) => field.id));
  const rules = form.conditionalRules.map((rule) => {
    const { sourceField, targetField } = rule;
    if (
      rule.crmInstanceId !== crmInstanceId ||
      rule.moduleKey !== moduleKey ||
      rule.formId !== form.id ||
      sourceField.id !== rule.sourceFieldId ||
      targetField.id !== rule.targetFieldId ||
      sourceField.crmInstanceId !== crmInstanceId ||
      sourceField.moduleKey !== moduleKey ||
      targetField.crmInstanceId !== crmInstanceId ||
      targetField.moduleKey !== moduleKey ||
      !activeFieldIds.has(sourceField.id) ||
      !activeFieldIds.has(targetField.id)
    ) {
      throw new RuntimeFormUnavailableError(
        "CRM form contains an invalid conditional rule reference.",
      );
    }
    try {
      return {
        ...validateConditionalRuleDefinition({
          crmInstanceId,
          moduleKey,
          formFieldIds,
          sourceField,
          targetField,
          operator: rule.operator,
          comparisonValue: rule.comparisonValue,
          action: rule.action,
        }),
        enabled: rule.enabled,
      };
    } catch (error) {
      if (!(error instanceof ConditionalRuleValidationError)) throw error;
      throw new RuntimeFormUnavailableError(
        "CRM form contains an invalid conditional rule definition.",
      );
    }
  });

  return {
    key: form.key,
    name: form.name,
    description: form.description,
    moduleKey,
    fields,
    disabledFieldKeys,
    rules,
  };
}

export async function getCrmRuntimeForm({
  moduleKey,
  formKey,
  tenant: suppliedTenant,
}: {
  moduleKey: string;
  formKey: string;
  tenant?: CrmTenantContext;
}): Promise<RuntimeForm> {
  const tenant =
    suppliedTenant ?? (await getCrmTenantContext(CRM_PERMISSIONS.FORMS_READ));
  await assertCrmRolePermission(tenant.crmRole, CRM_PERMISSIONS.FIELDS_READ);

  const record = await db.crmModuleConfiguration.findUnique({
    where: {
      crmInstanceId_moduleKey: {
        crmInstanceId: tenant.crmId,
        moduleKey,
      },
    },
    select: {
      crmInstanceId: true,
      moduleKey: true,
      enabled: true,
      forms: {
        where: { key: formKey },
        take: 1,
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          enabled: true,
          conditionalRules: {
            where: { enabled: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: {
              crmInstanceId: true,
              moduleKey: true,
              formId: true,
              sourceFieldId: true,
              targetFieldId: true,
              operator: true,
              comparisonValue: true,
              action: true,
              enabled: true,
              sourceField: {
                select: {
                  id: true,
                  crmInstanceId: true,
                  moduleKey: true,
                  key: true,
                  fieldType: true,
                  enabled: true,
                  options: {
                    select: { key: true, enabled: true },
                  },
                },
              },
              targetField: {
                select: {
                  id: true,
                  crmInstanceId: true,
                  moduleKey: true,
                  key: true,
                  fieldType: true,
                  enabled: true,
                  options: {
                    select: { key: true, enabled: true },
                  },
                },
              },
            },
          },
          formFields: {
            orderBy: [{ displayOrder: "asc" }, { fieldId: "asc" }],
            select: {
              crmInstanceId: true,
              moduleKey: true,
              displayOrder: true,
              requiredOverride: true,
              field: {
                select: {
                  id: true,
                  crmInstanceId: true,
                  moduleKey: true,
                  key: true,
                  label: true,
                  fieldType: true,
                  origin: true,
                  backingColumn: true,
                  required: true,
                  enabled: true,
                  displayOrder: true,
                  minLength: true,
                  maxLength: true,
                  minValue: true,
                  maxValue: true,
                  pattern: true,
                  options: {
                    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
                    select: {
                      crmInstanceId: true,
                      moduleKey: true,
                      fieldId: true,
                      key: true,
                      label: true,
                      enabled: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return normalizeRuntimeForm(record, tenant.crmId, moduleKey, formKey);
}

const OPERATIONAL_FORM_KEYS = {
  companies: { create: "company_create", edit: "company_edit" },
  contacts: { create: "contact_create", edit: "contact_edit" },
  leads: { create: "lead_create", edit: "lead_edit" },
  tasks: { create: "task_create", edit: "task_edit" },
} as const;

export async function getCrmOperationalForm({
  tenant,
  moduleKey,
  operation,
}: {
  tenant: CrmTenantContext;
  moduleKey: keyof typeof OPERATIONAL_FORM_KEYS;
  operation: "create" | "edit";
}): Promise<RuntimeForm | null> {
  await assertCrmRolePermission(tenant.crmRole, CRM_PERMISSIONS.FORMS_READ);
  await assertCrmRolePermission(tenant.crmRole, CRM_PERMISSIONS.FIELDS_READ);

  const formKey = OPERATIONAL_FORM_KEYS[moduleKey][operation];
  const configuredForm = await db.crmForm.findFirst({
    where: {
      crmInstanceId: tenant.crmId,
      moduleKey,
      key: formKey,
      enabled: true,
    },
    select: { id: true },
  });
  if (!configuredForm) return null;

  const form = await getCrmRuntimeForm({ tenant, moduleKey, formKey });
  const customTargetKeys = new Set(
    form.fields
      .filter((field) => field.origin === "CUSTOM")
      .map((field) => field.key),
  );
  return {
    ...form,
    rules: form.rules.filter((rule) => customTargetKeys.has(rule.targetFieldKey)),
  };
}
