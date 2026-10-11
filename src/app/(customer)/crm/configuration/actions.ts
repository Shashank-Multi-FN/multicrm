"use server";

import {
  CrmFieldOrigin,
  CrmFieldType,
  Prisma,
} from "@prisma/client/index";
import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  ConditionalRuleValidationError,
  type ConditionalRuleFieldMetadata,
  validateConditionalRuleDefinition,
} from "@/lib/crm/conditional-logic";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS } from "@/lib/crm/permissions";
import { db } from "@/lib/db";

export type ConfigurationActionState = {
  error?: string;
  success?: string;
};

class ConfigurationValidationError extends Error {}

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const MODULE_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const FIELD_TYPES = Object.values(CrmFieldType);
const REQUIRED_SYSTEM_FIELDS: Record<string, readonly string[]> = {
  companies: ["name"],
  contacts: ["first_name", "last_name"],
  leads: ["first_name", "last_name"],
  tasks: ["title"],
};

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalInteger(formData: FormData, name: string) {
  const raw = value(formData, name);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) {
    throw new ConfigurationValidationError(`${name} must be a non-negative whole number.`);
  }
  return parsed;
}

function optionalNumber(formData: FormData, name: string) {
  const raw = value(formData, name);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new ConfigurationValidationError(`${name} must be a valid number.`);
  }
  return parsed;
}

function requiredOverride(formData: FormData) {
  const value = formData.get("requiredOverride");
  if (value === "inherit") return null;
  if (value === "required") return true;
  if (value === "optional") return false;
  throw new ConfigurationValidationError("Choose a valid required-field setting.");
}

async function requireModule(crmInstanceId: string, moduleKey: string) {
  if (!MODULE_KEY_PATTERN.test(moduleKey)) {
    throw new ConfigurationValidationError("Invalid module key.");
  }
  const moduleConfiguration = await db.crmModuleConfiguration.findUnique({
    where: { crmInstanceId_moduleKey: { crmInstanceId, moduleKey } },
    select: { moduleKey: true },
  });
  if (!moduleConfiguration) {
    throw new ConfigurationValidationError("Module was not found in this CRM.");
  }
}

type PersistedValueLookupModel = {
  findFirst: (args: {
    where: Record<string, string>;
    select: { id: true };
  }) => Promise<{ id: string } | null>;
};

async function hasPersistedFieldValues(
  crmInstanceId: string,
  moduleKey: string,
  fieldId: string,
): Promise<boolean> {
  const models: PersistedValueLookupModel[] = [
    db.customCompanyFieldValue,
    db.customContactFieldValue,
    db.customLeadFieldValue,
    db.customTaskFieldValue,
  ];

  const checks = await Promise.all(
    models.map((model) =>
      model.findFirst({
        where: {
          crmInstanceId,
          moduleKey,
          fieldId,
        },
        select: { id: true },
      }),
    ),
  );

  return checks.some(Boolean);
}

async function hasPersistedOptionValues(
  crmInstanceId: string,
  moduleKey: string,
  optionId: string,
): Promise<boolean> {
  const models: PersistedValueLookupModel[] = [
    db.customCompanyFieldValue,
    db.customContactFieldValue,
    db.customLeadFieldValue,
    db.customTaskFieldValue,
  ];

  const checks = await Promise.all(
    models.map((model) =>
      model.findFirst({
        where: {
          crmInstanceId,
          optionModuleKey: moduleKey,
          optionId,
        },
        select: { id: true },
      }),
    ),
  );

  return checks.some(Boolean);
}

async function hasConditionalRulesForField(
  crmInstanceId: string,
  moduleKey: string,
  fieldId: string,
): Promise<boolean> {
  return Boolean(
    await db.crmConditionalRule.findFirst({
      where: {
        crmInstanceId,
        moduleKey,
        OR: [{ sourceFieldId: fieldId }, { targetFieldId: fieldId }],
      },
      select: { id: true },
    }),
  );
}

async function hasWorkflowConditionsForField(
  crmInstanceId: string,
  moduleKey: string,
  fieldId: string,
): Promise<boolean> {
  return Boolean(
    await db.crmWorkflowCondition.findFirst({
      where: { crmInstanceId, moduleKey, fieldId },
      select: { id: true },
    }),
  );
}

async function resolveConditionalRuleFields(
  crmInstanceId: string,
  moduleKey: string,
  formId: string,
  sourceFieldId: string,
  targetFieldId: string,
) {
  const form = await db.crmForm.findFirst({
    where: { id: formId, crmInstanceId, moduleKey },
    select: {
      id: true,
      formFields: {
        select: {
          field: {
            select: {
              id: true,
              key: true,
              crmInstanceId: true,
              moduleKey: true,
              fieldType: true,
              enabled: true,
              options: {
                select: { key: true, enabled: true },
              },
            },
          },
        },
      },
    },
  });
  if (!form) {
    throw new ConfigurationValidationError(
      "Form was not found in this CRM module.",
    );
  }

  const formFieldIds = form.formFields.map(({ field }) => field.id);
  const fieldsById = new Map(
    form.formFields.map(({ field }) => [field.id, field]),
  );
  const sourceField = fieldsById.get(sourceFieldId);
  const targetField = fieldsById.get(targetFieldId);
  if (!sourceField || !targetField) {
    throw new ConfigurationValidationError(
      "Condition fields must be attached to this CRM form.",
    );
  }
  return {
    formId: form.id,
    formFieldIds,
    sourceField: sourceField as ConditionalRuleFieldMetadata,
    targetField: targetField as ConditionalRuleFieldMetadata,
  };
}

function readComparisonValue(formData: FormData): string | null {
  const raw = formData.get("comparisonValue");
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new ConfigurationValidationError(
      "Enter a valid conditional comparison value.",
    );
  }
  return raw;
}

async function finish(
  moduleKey: string,
  message: string,
): Promise<ConfigurationActionState> {
  revalidatePath("/crm/configuration");
  revalidatePath(`/crm/configuration/${moduleKey}`);
  return { success: message };
}

async function runConfigurationAction(
  permission: typeof CRM_PERMISSIONS.FIELDS_MANAGE | typeof CRM_PERMISSIONS.FORMS_MANAGE,
  formData: FormData,
  action: (crmId: string, moduleKey: string) => Promise<ConfigurationActionState>,
): Promise<ConfigurationActionState> {
  try {
    const tenant = await getCrmTenantContext(permission);
    const moduleKey = value(formData, "moduleKey");
    await requireModule(tenant.crmId, moduleKey);
    const result = await action(tenant.crmId, moduleKey);
    await db.crmConfigurationAuditLog.create({
      data: {
        crmInstanceId: tenant.crmId,
        moduleKey,
        entityType: "crm_configuration",
        entityId: moduleKey,
        action: permission === CRM_PERMISSIONS.FIELDS_MANAGE ? "fields_manage" : "forms_manage",
        actorUserId: tenant.userId,
        details: {
          permission,
          formDataKeys: Array.from(formData.keys()),
        },
      },
    });
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to manage this CRM configuration." };
    }
    if (error instanceof ConfigurationValidationError) {
      return { error: error.message };
    }
    if (error instanceof ConditionalRuleValidationError) {
      return { error: error.message };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "That key already exists in this module." };
    }
    console.error("CRM configuration action failed.", error);
    return { error: "Unable to save this CRM configuration right now." };
  }
}

export async function createCustomField(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FIELDS_MANAGE, formData, async (crmId, moduleKey) => {
    const key = value(formData, "key");
    const label = value(formData, "label");
    const requestedFieldType = value(formData, "fieldType");
    const fieldType = FIELD_TYPES.find((type) => type === requestedFieldType);
    const displayOrder = optionalInteger(formData, "displayOrder") ?? 0;
    if (!KEY_PATTERN.test(key)) {
      throw new ConfigurationValidationError("Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.");
    }
    const duplicateField = await db.crmFieldDefinition.findFirst({
      where: { crmInstanceId: crmId, moduleKey, key },
      select: { id: true },
    });
    if (duplicateField) {
      throw new ConfigurationValidationError("A field with this key already exists in this CRM module.");
    }
    if (!label || label.length > 100) {
      throw new ConfigurationValidationError("Field label must be between 1 and 100 characters.");
    }
    if (!fieldType) {
      throw new ConfigurationValidationError("Select a valid field type.");
    }

    const optionLines = value(formData, "options")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (fieldType === CrmFieldType.SELECT && optionLines.length === 0) {
      throw new ConfigurationValidationError("Add at least one SELECT option as key|label.");
    }
    if (fieldType !== CrmFieldType.SELECT && optionLines.length > 0) {
      throw new ConfigurationValidationError("Options can only be added to SELECT fields.");
    }
    const minLength = optionalInteger(formData, "minLength");
    const maxLength = optionalInteger(formData, "maxLength");
    const minValue = optionalNumber(formData, "minValue");
    const maxValue = optionalNumber(formData, "maxValue");
    const pattern = value(formData, "pattern");
    if (minLength !== null && maxLength !== null && minLength > maxLength) {
      throw new ConfigurationValidationError("Minimum length cannot exceed maximum length.");
    }
    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      throw new ConfigurationValidationError("Minimum value cannot exceed maximum value.");
    }
    if (pattern.length > 500) {
      throw new ConfigurationValidationError("Pattern must be 500 characters or fewer.");
    }
    const options = optionLines.map((line, sortOrder) => {
      const separator = line.indexOf("|");
      const optionKey = line.slice(0, separator).trim();
      const optionLabel = line.slice(separator + 1).trim();
      if (separator < 1 || !KEY_PATTERN.test(optionKey) || !optionLabel || optionLabel.length > 100) {
        throw new ConfigurationValidationError("Each option must use a valid key|label pair.");
      }
      return { key: optionKey, label: optionLabel, sortOrder };
    });
    if (new Set(options.map((option) => option.key)).size !== options.length) {
      throw new ConfigurationValidationError("Option keys must be unique within the field.");
    }

    await db.$transaction(async (transaction) => {
      const field = await transaction.crmFieldDefinition.create({
        data: {
          crmInstanceId: crmId,
          moduleKey,
          key,
          label,
          fieldType,
          origin: CrmFieldOrigin.CUSTOM,
          required: formData.get("required") === "on",
          enabled: formData.get("enabled") === "on",
          displayOrder,
          minLength:
            fieldType === CrmFieldType.TEXT || fieldType === CrmFieldType.TEXTAREA
              ? minLength
              : null,
          maxLength:
            fieldType === CrmFieldType.TEXT || fieldType === CrmFieldType.TEXTAREA
              ? maxLength
              : null,
          minValue: fieldType === CrmFieldType.NUMBER ? minValue : null,
          maxValue: fieldType === CrmFieldType.NUMBER ? maxValue : null,
          pattern: pattern || null,
        },
        select: { id: true },
      });
      if (options.length > 0) {
        await transaction.crmFieldOption.createMany({
          data: options.map((option) => ({
            crmInstanceId: crmId,
            moduleKey,
            fieldId: field.id,
            ...option,
          })),
        });
      }
    });
    return finish(moduleKey, "Custom field created.");
  });
}

export async function updateField(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FIELDS_MANAGE, formData, async (crmId, moduleKey) => {
    const fieldId = value(formData, "fieldId");
    const field = await db.crmFieldDefinition.findFirst({
      where: { id: fieldId, crmInstanceId: crmId, moduleKey },
      select: {
        id: true,
        key: true,
        origin: true,
        fieldType: true,
        backingColumn: true,
      },
    });
    if (!field) throw new ConfigurationValidationError("Field was not found in this CRM module.");
    if (
      field.origin === CrmFieldOrigin.SYSTEM &&
      REQUIRED_SYSTEM_FIELDS[moduleKey]?.includes(field.key) &&
      formData.get("required") !== "on"
    ) {
      throw new ConfigurationValidationError(
        "This system field must remain required by its operational model.",
      );
    }
    if (formData.has("key") && value(formData, "key") !== field.key) {
      throw new ConfigurationValidationError("Field keys cannot be changed.");
    }
    if (formData.has("origin") && value(formData, "origin") !== field.origin) {
      throw new ConfigurationValidationError("Field origin cannot be changed.");
    }
    if (
      formData.has("backingColumn") &&
      value(formData, "backingColumn") !== (field.backingColumn ?? "")
    ) {
      throw new ConfigurationValidationError("System field backing columns cannot be changed.");
    }
    if (
      formData.has("fieldType") &&
      value(formData, "fieldType") !== field.fieldType
    ) {
      throw new ConfigurationValidationError("Field types cannot be changed after creation.");
    }

    const label = value(formData, "label");
    const minLength = optionalInteger(formData, "minLength");
    const maxLength = optionalInteger(formData, "maxLength");
    const minValue = optionalNumber(formData, "minValue");
    const maxValue = optionalNumber(formData, "maxValue");
    const pattern = value(formData, "pattern");
    if (!label || label.length > 100) {
      throw new ConfigurationValidationError("Field label must be between 1 and 100 characters.");
    }
    if (minLength !== null && maxLength !== null && minLength > maxLength) {
      throw new ConfigurationValidationError("Minimum length cannot exceed maximum length.");
    }
    if (minValue !== null && maxValue !== null && minValue > maxValue) {
      throw new ConfigurationValidationError("Minimum value cannot exceed maximum value.");
    }
    if (pattern.length > 500) {
      throw new ConfigurationValidationError("Pattern must be 500 characters or fewer.");
    }

    const enabled = formData.get("enabled") === "on";
    await db.$transaction(async (transaction) => {
      await transaction.crmFieldDefinition.update({
        where: { id: field.id },
        data: {
          label,
          required: formData.get("required") === "on",
          enabled,
          displayOrder: optionalInteger(formData, "displayOrder") ?? 0,
          minLength: field.fieldType === CrmFieldType.TEXT || field.fieldType === CrmFieldType.TEXTAREA ? minLength : null,
          maxLength: field.fieldType === CrmFieldType.TEXT || field.fieldType === CrmFieldType.TEXTAREA ? maxLength : null,
          minValue: field.fieldType === CrmFieldType.NUMBER ? minValue : null,
          maxValue: field.fieldType === CrmFieldType.NUMBER ? maxValue : null,
          pattern: pattern || null,
        },
      });
      if (!enabled) {
        await transaction.crmConditionalRule.updateMany({
          where: {
            crmInstanceId: crmId,
            moduleKey,
            enabled: true,
            OR: [{ sourceFieldId: field.id }, { targetFieldId: field.id }],
          },
          data: { enabled: false },
        });
      }
    });
    return finish(moduleKey, "Field configuration saved.");
  });
}

export async function deleteCustomField(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FIELDS_MANAGE, formData, async (crmId, moduleKey) => {
    const fieldId = value(formData, "fieldId");
    const field = await db.crmFieldDefinition.findFirst({
      where: { id: fieldId, crmInstanceId: crmId, moduleKey },
      select: { id: true, origin: true },
    });
    if (!field) throw new ConfigurationValidationError("Field was not found in this CRM module.");
    if (field.origin !== CrmFieldOrigin.CUSTOM) {
      throw new ConfigurationValidationError("System fields cannot be deleted.");
    }
    if (await hasConditionalRulesForField(crmId, moduleKey, fieldId)) {
      throw new ConfigurationValidationError(
        "Delete conditional rules that reference this field before deleting it.",
      );
    }
    if (await hasWorkflowConditionsForField(crmId, moduleKey, fieldId)) {
      throw new ConfigurationValidationError(
        "Delete workflow conditions that reference this field before deleting it.",
      );
    }
    if (await hasPersistedFieldValues(crmId, moduleKey, fieldId)) {
      throw new ConfigurationValidationError(
        "This custom field has persisted values. Disable it instead of deleting it.",
      );
    }
    await db.crmFieldDefinition.delete({ where: { id: field.id } });
    return finish(moduleKey, "Custom field deleted.");
  });
}

export async function createFieldOption(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FIELDS_MANAGE, formData, async (crmId, moduleKey) => {
    const fieldId = value(formData, "fieldId");
    const field = await db.crmFieldDefinition.findFirst({
      where: { id: fieldId, crmInstanceId: crmId, moduleKey },
      select: { id: true, fieldType: true },
    });
    if (!field || field.fieldType !== CrmFieldType.SELECT) {
      throw new ConfigurationValidationError("Options can only be added to a SELECT field in this CRM module.");
    }
    const key = value(formData, "key");
    const label = value(formData, "label");
    if (!KEY_PATTERN.test(key) || !label || label.length > 100) {
      throw new ConfigurationValidationError("Enter a valid option key and label.");
    }
    const existingOption = await db.crmFieldOption.findFirst({
      where: { crmInstanceId: crmId, moduleKey, fieldId, key },
      select: { id: true },
    });
    if (existingOption) {
      throw new ConfigurationValidationError("An option with this key already exists for this field.");
    }
    await db.crmFieldOption.create({
      data: {
        crmInstanceId: crmId,
        moduleKey,
        fieldId,
        key,
        label,
        enabled: formData.get("enabled") === "on",
        sortOrder: optionalInteger(formData, "sortOrder") ?? 0,
      },
    });
    return finish(moduleKey, "Option added.");
  });
}

export async function updateFieldOption(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FIELDS_MANAGE, formData, async (crmId, moduleKey) => {
    const optionId = value(formData, "optionId");
    const fieldId = value(formData, "fieldId");
    const option = await db.crmFieldOption.findFirst({
      where: {
        id: optionId,
        crmInstanceId: crmId,
        moduleKey,
        ...(fieldId ? { fieldId } : {}),
      },
      select: { id: true, key: true, fieldId: true },
    });
    if (!option) throw new ConfigurationValidationError("Option was not found in this CRM module and field.");
    if (formData.has("key") && value(formData, "key") !== option.key) {
      throw new ConfigurationValidationError("Option keys cannot be changed.");
    }
    const label = value(formData, "label");
    if (!label || label.length > 100) throw new ConfigurationValidationError("Option label must be between 1 and 100 characters.");
    const enabled = formData.get("enabled") === "on";
    await db.$transaction(async (transaction) => {
      await transaction.crmFieldOption.update({
        where: { id: option.id },
        data: {
          label,
          enabled,
          sortOrder: optionalInteger(formData, "sortOrder") ?? 0,
        },
      });
      if (!enabled) {
        await transaction.crmConditionalRule.updateMany({
          where: {
            crmInstanceId: crmId,
            moduleKey,
            sourceFieldId: option.fieldId,
            comparisonValue: option.key,
            operator: { in: ["EQUALS", "NOT_EQUALS"] },
            enabled: true,
          },
          data: { enabled: false },
        });
      }
    });
    return finish(moduleKey, "Option updated.");
  });
}

export async function deleteFieldOption(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FIELDS_MANAGE, formData, async (crmId, moduleKey) => {
    const optionId = value(formData, "optionId");
    const fieldId = value(formData, "fieldId");
    const option = await db.crmFieldOption.findFirst({
      where: {
        id: optionId,
        crmInstanceId: crmId,
        moduleKey,
        ...(fieldId ? { fieldId } : {}),
      },
      select: { id: true, fieldId: true, key: true },
    });
    if (!option) throw new ConfigurationValidationError("Option was not found in this CRM module and field.");
    if (await hasPersistedOptionValues(crmId, moduleKey, optionId)) {
      throw new ConfigurationValidationError(
        "This option has persisted values. Disable it instead of deleting it.",
      );
    }
    const linkedRule = await db.crmConditionalRule.findFirst({
      where: {
        crmInstanceId: crmId,
        moduleKey,
        sourceFieldId: option.fieldId,
        comparisonValue: option.key,
        operator: { in: ["EQUALS", "NOT_EQUALS"] },
      },
      select: { id: true },
    });
    if (linkedRule) {
      throw new ConfigurationValidationError(
        "Delete conditional rules that compare this option before deleting it.",
      );
    }
    await db.crmFieldOption.delete({ where: { id: option.id } });
    return finish(moduleKey, "Option disabled.");
  });
}

export async function createForm(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const key = value(formData, "key");
    const name = value(formData, "name");
    if (!KEY_PATTERN.test(key)) throw new ConfigurationValidationError("Form key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.");
    if (!name || name.length > 100) throw new ConfigurationValidationError("Form name must be between 1 and 100 characters.");
    await db.crmForm.create({
      data: {
        crmInstanceId: crmId,
        moduleKey,
        key,
        name,
        description: value(formData, "description") || null,
        enabled: formData.get("enabled") === "on",
      },
    });
    return finish(moduleKey, "Form created.");
  });
}

export async function updateForm(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const formId = value(formData, "formId");
    const form = await db.crmForm.findFirst({
      where: { id: formId, crmInstanceId: crmId, moduleKey },
      select: { id: true },
    });
    if (!form) throw new ConfigurationValidationError("Form was not found in this CRM module.");
    const name = value(formData, "name");
    if (!name || name.length > 100) throw new ConfigurationValidationError("Form name must be between 1 and 100 characters.");
    await db.crmForm.update({
      where: { id: form.id },
      data: {
        name,
        description: value(formData, "description") || null,
        enabled: formData.get("enabled") === "on",
      },
    });
    return finish(moduleKey, "Form configuration saved.");
  });
}

export async function addFieldToForm(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const formId = value(formData, "formId");
    const fieldId = value(formData, "fieldId");
    const [form, field] = await Promise.all([
      db.crmForm.findFirst({
        where: { id: formId, crmInstanceId: crmId, moduleKey },
        select: { id: true, enabled: true },
      }),
      db.crmFieldDefinition.findFirst({
        where: { id: fieldId, crmInstanceId: crmId, moduleKey },
        select: { id: true, enabled: true },
      }),
    ]);
    if (!form || !field) throw new ConfigurationValidationError("Form and field must belong to this CRM module.");
    if (!form.enabled) throw new ConfigurationValidationError("Enable the form before changing its fields.");
    if (!field.enabled) throw new ConfigurationValidationError("Disabled fields cannot be added to a form.");
    await db.crmFormField.create({
      data: {
        crmInstanceId: crmId,
        moduleKey,
        formId,
        fieldId,
        displayOrder: optionalInteger(formData, "displayOrder") ?? 0,
        requiredOverride: requiredOverride(formData),
      },
    });
    return finish(moduleKey, "Field added to form.");
  });
}

export async function updateFormField(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const formFieldId = value(formData, "formFieldId");
    const formField = await db.crmFormField.findFirst({
      where: { id: formFieldId, crmInstanceId: crmId, moduleKey },
      select: { id: true },
    });
    if (!formField) throw new ConfigurationValidationError("Form field was not found in this CRM module.");
    await db.crmFormField.update({
      where: { id: formField.id },
      data: {
        displayOrder: optionalInteger(formData, "displayOrder") ?? 0,
        requiredOverride: requiredOverride(formData),
      },
    });
    return finish(moduleKey, "Form field updated.");
  });
}

export async function removeFieldFromForm(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const formFieldId = value(formData, "formFieldId");
    const formField = await db.crmFormField.findFirst({
      where: { id: formFieldId, crmInstanceId: crmId, moduleKey },
      select: { id: true, formId: true, fieldId: true },
    });
    if (!formField) {
      throw new ConfigurationValidationError(
        "Form field was not found in this CRM module.",
      );
    }
    const linkedRule = await db.crmConditionalRule.findFirst({
      where: {
        crmInstanceId: crmId,
        moduleKey,
        formId: formField.formId,
        OR: [
          { sourceFieldId: formField.fieldId },
          { targetFieldId: formField.fieldId },
        ],
      },
      select: { id: true },
    });
    if (linkedRule) {
      throw new ConfigurationValidationError(
        "Delete conditional rules that reference this field before removing it from the form.",
      );
    }
    const result = await db.crmFormField.deleteMany({
      where: { id: formFieldId, crmInstanceId: crmId, moduleKey },
    });
    if (result.count !== 1) throw new ConfigurationValidationError("Form field was not found in this CRM module.");
    return finish(moduleKey, "Field removed from form.");
  });
}

export async function createConditionalRule(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const formId = value(formData, "formId");
    const sourceFieldId = value(formData, "sourceFieldId");
    const targetFieldId = value(formData, "targetFieldId");
    const resolved = await resolveConditionalRuleFields(
      crmId,
      moduleKey,
      formId,
      sourceFieldId,
      targetFieldId,
    );
    const definition = validateConditionalRuleDefinition({
      crmInstanceId: crmId,
      moduleKey,
      formFieldIds: resolved.formFieldIds,
      sourceField: resolved.sourceField,
      targetField: resolved.targetField,
      operator: value(formData, "operator"),
      comparisonValue: readComparisonValue(formData),
      action: value(formData, "action"),
    });

    await db.crmConditionalRule.create({
      data: {
        crmInstanceId: crmId,
        moduleKey,
        formId: resolved.formId,
        sourceFieldId: resolved.sourceField.id,
        targetFieldId: resolved.targetField.id,
        operator: definition.operator,
        comparisonValue: definition.comparisonValue,
        action: definition.action,
        enabled: formData.get("enabled") === "on",
        sortOrder: optionalInteger(formData, "sortOrder") ?? 0,
      },
    });
    return finish(moduleKey, "Conditional rule created.");
  });
}

export async function updateConditionalRule(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const formId = value(formData, "formId");
    const ruleId = value(formData, "ruleId");
    const existing = await db.crmConditionalRule.findFirst({
      where: { id: ruleId, crmInstanceId: crmId, moduleKey, formId },
      select: { id: true },
    });
    if (!existing) {
      throw new ConfigurationValidationError(
        "Conditional rule was not found in this CRM form.",
      );
    }

    const sourceFieldId = value(formData, "sourceFieldId");
    const targetFieldId = value(formData, "targetFieldId");
    const resolved = await resolveConditionalRuleFields(
      crmId,
      moduleKey,
      formId,
      sourceFieldId,
      targetFieldId,
    );
    const definition = validateConditionalRuleDefinition({
      crmInstanceId: crmId,
      moduleKey,
      formFieldIds: resolved.formFieldIds,
      sourceField: resolved.sourceField,
      targetField: resolved.targetField,
      operator: value(formData, "operator"),
      comparisonValue: readComparisonValue(formData),
      action: value(formData, "action"),
    });

    await db.crmConditionalRule.update({
      where: { id: existing.id },
      data: {
        sourceFieldId: resolved.sourceField.id,
        targetFieldId: resolved.targetField.id,
        operator: definition.operator,
        comparisonValue: definition.comparisonValue,
        action: definition.action,
        enabled: formData.get("enabled") === "on",
        sortOrder: optionalInteger(formData, "sortOrder") ?? 0,
      },
    });
    return finish(moduleKey, "Conditional rule updated.");
  });
}

export async function deleteConditionalRule(
  _previous: ConfigurationActionState,
  formData: FormData,
): Promise<ConfigurationActionState> {
  return runConfigurationAction(CRM_PERMISSIONS.FORMS_MANAGE, formData, async (crmId, moduleKey) => {
    const result = await db.crmConditionalRule.deleteMany({
      where: {
        id: value(formData, "ruleId"),
        formId: value(formData, "formId"),
        crmInstanceId: crmId,
        moduleKey,
      },
    });
    if (result.count !== 1) {
      throw new ConfigurationValidationError(
        "Conditional rule was not found in this CRM form.",
      );
    }
    return finish(moduleKey, "Conditional rule deleted.");
  });
}
