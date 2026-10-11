import "server-only";

import {
  CrmFieldOrigin,
  CrmFieldType,
  Prisma,
  type Prisma as PrismaTypes,
} from "@prisma/client/index";
import { AuthorizationError } from "@/lib/auth/errors";
import { assertCrmRolePermission } from "@/lib/auth/authorization";
import { getCrmTenantContext } from "@/lib/crm/context";
import { CRM_PERMISSIONS, type CrmPermission } from "@/lib/crm/permissions";
import { db } from "@/lib/db";
import type { RuntimeForm, RuntimeFormField } from "@/lib/crm/runtime-forms";
import { validateCrmRuntimeForm } from "@/lib/crm/runtime-validation";

type CustomValueModule = "companies" | "contacts" | "leads" | "tasks";

type StoredColumns = {
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  dateValue: Date | null;
  datetimeValue: Date | null;
  optionCrmInstanceId: string | null;
  optionModuleKey: string | null;
  optionFieldId: string | null;
  optionId: string | null;
};

type PreparedWrite = {
  tenantId: string;
  moduleKey: CustomValueModule;
  recordId: string;
  fieldId: string;
  fieldType: CrmFieldType;
  fieldOrigin: CrmFieldOrigin;
  columns: StoredColumns | null;
};

type WriteInput = {
  recordId: string;
  fieldId: string;
  value: unknown;
};

type UpdateInput = WriteInput & { valueId: string };
type DeleteInput = Omit<UpdateInput, "value">;

const MODULE_PERMISSIONS: Readonly<
  Record<CustomValueModule, CrmPermission>
> = {
  companies: CRM_PERMISSIONS.COMPANIES_UPDATE,
  contacts: CRM_PERMISSIONS.CONTACTS_UPDATE,
  leads: CRM_PERMISSIONS.LEADS_UPDATE,
  tasks: CRM_PERMISSIONS.TASKS_UPDATE,
};

export class CustomFieldValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomFieldValueError";
  }
}

export class CustomFieldValueConflictError extends CustomFieldValueError {
  constructor(message: string) {
    super(message);
    this.name = "CustomFieldValueConflictError";
  }
}

function asModuleKey(moduleKey: string): CustomValueModule {
  switch (moduleKey) {
    case "companies":
    case "contacts":
    case "leads":
    case "tasks":
      return moduleKey;
    default:
      throw new CustomFieldValueError(
        "Custom values are not supported for this CRM module.",
      );
  }
}

const MODULE_READ_PERMISSIONS: Readonly<
  Record<CustomValueModule, CrmPermission>
> = {
  companies: CRM_PERMISSIONS.COMPANIES_READ,
  contacts: CRM_PERMISSIONS.CONTACTS_READ,
  leads: CRM_PERMISSIONS.LEADS_READ,
  tasks: CRM_PERMISSIONS.TASKS_READ,
};

export type CustomFieldDisplayValue = {
  id: string;
  key: string;
  label: string;
  fieldType: CrmFieldType;
  required: boolean;
  value: string | number | boolean | null;
  displayValue: string | null;
  optionKey: string | null;
  optionLabel: string | null;
  options: { key: string; label: string }[];
};

export type ResolvedCustomFieldValues = {
  valid: boolean;
  errors: Record<string, string>;
  values: Record<string, unknown>;
  fields: Array<{
    id: string;
    key: string;
    label: string;
    fieldType: CrmFieldType;
    required: boolean;
    minLength: number | null;
    maxLength: number | null;
    minValue: number | null;
    maxValue: number | null;
    pattern: string | null;
    options: { id: string; key: string; label: string; enabled: boolean }[];
  }>;
};

export async function getCustomFieldDefinitionsForModule({
  moduleKey,
  crmInstanceId,
}: {
  moduleKey: string;
  crmInstanceId: string;
}) {
  const normalizedModuleKey = asModuleKey(moduleKey);

  const fields = await db.crmFieldDefinition.findMany({
    where: {
      crmInstanceId,
      moduleKey: normalizedModuleKey,
      origin: CrmFieldOrigin.CUSTOM,
      enabled: true,
      moduleConfiguration: {
        enabled: true,
      },
    },
    select: {
      id: true,
      key: true,
      label: true,
      fieldType: true,
      required: true,
      options: {
        select: {
          id: true,
          key: true,
          label: true,
          enabled: true,
        },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      },
    },
  });

  return fields.map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    fieldType: field.fieldType,
    origin: CrmFieldOrigin.CUSTOM,
    backingColumn: null,
    required: field.required,
    value: null,
    displayValue: null,
    optionKey: null,
    optionLabel: null,
    options: field.options
      .filter((option) => option.enabled)
      .map((option) => ({ key: option.key, label: option.label })),
  }));
}

export function normalizeCustomFieldInputValue(
  value: unknown,
): string | number | boolean | null {
  if (typeof value === "undefined") {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return String(value);
}

export async function resolveCustomFieldValuesForModule({
  tenant,
  moduleKey,
  formData,
  conditionalForm,
  systemValues = {},
}: {
  tenant: Awaited<ReturnType<typeof getCrmTenantContext>>;
  moduleKey: string;
  formData: FormData;
  conditionalForm?: RuntimeForm | null;
  systemValues?: Record<string, unknown>;
}): Promise<ResolvedCustomFieldValues> {
  const normalizedModuleKey = asModuleKey(moduleKey);

  const fields = await db.crmFieldDefinition.findMany({
    where: {
      crmInstanceId: tenant.crmId,
      moduleKey: normalizedModuleKey,
      origin: CrmFieldOrigin.CUSTOM,
      enabled: true,
      moduleConfiguration: {
        enabled: true,
      },
    },
    select: {
      id: true,
      key: true,
      label: true,
      fieldType: true,
      required: true,
      minLength: true,
      maxLength: true,
      minValue: true,
      maxValue: true,
      pattern: true,
      options: {
        where: { enabled: true },
        select: {
          id: true,
          key: true,
          label: true,
          enabled: true,
        },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      },
    },
  });

  const values: Record<string, unknown> = {};
  for (const [name, rawValue] of formData.entries()) {
    if (!name.startsWith("field:")) {
      continue;
    }

    const key = name.slice("field:".length);
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      values[key] = [values[key], rawValue];
    } else {
      values[key] = rawValue;
    }
  }

  for (const field of fields) {
    if (field.fieldType === CrmFieldType.BOOLEAN) {
      if (!Object.prototype.hasOwnProperty.call(values, field.key)) {
        values[field.key] = false;
      }
    }
  }

  const customFieldKeys = new Set(fields.map((field) => field.key));
  const operationalRules = (conditionalForm?.rules ?? []).filter((rule) =>
    customFieldKeys.has(rule.targetFieldKey),
  );
  const attachedFieldsByKey = new Map(
    (conditionalForm?.fields ?? []).map((field) => [field.key, field]),
  );
  const systemConditionFields = new Map<string, RuntimeFormField>();
  for (const rule of operationalRules) {
    const source = attachedFieldsByKey.get(rule.sourceFieldKey);
    const target = attachedFieldsByKey.get(rule.targetFieldKey);
    if (!source || !target || target.origin !== CrmFieldOrigin.CUSTOM) {
      throw new CustomFieldValueError(
        "Conditional rule references a field outside the operational form.",
      );
    }
    if (source.origin === CrmFieldOrigin.SYSTEM) {
      if (!source.backingColumn) {
        throw new CustomFieldValueError(
          "Conditional system source has no operational field mapping.",
        );
      }
      systemConditionFields.set(source.key, source);
      const sourceValue = systemValues[source.backingColumn];
      values[source.key] =
        source.fieldType === CrmFieldType.BOOLEAN && sourceValue === undefined
          ? false
          : sourceValue ?? null;
    } else if (!customFieldKeys.has(source.key)) {
      throw new CustomFieldValueError(
        "Conditional rule source is not available for operational validation.",
      );
    }
  }

  const conditionFields = Array.from(systemConditionFields.values()).map(
    (field) => ({ ...field, required: false }),
  );
  const runtimeForm = {
    key: `${normalizedModuleKey}_custom_fields`,
    name: `${normalizedModuleKey} custom fields`,
    description: null,
    moduleKey: normalizedModuleKey,
    fields: fields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      origin: CrmFieldOrigin.CUSTOM,
      backingColumn: null,
      required: field.required,
      displayOrder: 0,
      validation: {
        minLength: field.minLength,
        maxLength: field.maxLength,
        minValue: field.minValue,
        maxValue: field.maxValue,
        pattern: field.pattern,
      },
      options: field.options.map((option) => ({
        key: option.key,
        label: option.label,
      })),
    })),
    conditionFields,
    disabledFieldKeys: [],
    rules: operationalRules,
  };

  const result = validateCrmRuntimeForm(runtimeForm, values);
  return {
    valid: result.valid,
    errors: result.errors,
    values: result.values,
    fields,
  };
}

export function buildCustomFieldPayloadForModule({
  moduleKey,
  field,
  value,
  recordId,
  crmInstanceId,
}: {
  moduleKey: CustomValueModule;
  field: {
    id: string;
    key: string;
    fieldType: CrmFieldType;
    options: { id: string; key: string }[];
  };
  value: string | number | boolean | null;
  recordId: string;
  crmInstanceId: string;
}) {
  const base = {
    crmInstanceId,
    moduleKey,
    recordId,
    fieldId: field.id,
    fieldType: field.fieldType,
    fieldOrigin: CrmFieldOrigin.CUSTOM,
  };

  if (value === null || value === undefined) {
    return null;
  }

  switch (field.fieldType) {
    case CrmFieldType.TEXT:
    case CrmFieldType.TEXTAREA:
    case CrmFieldType.EMAIL:
    case CrmFieldType.PHONE:
      return {
        ...base,
        textValue: String(value),
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        datetimeValue: null,
        optionCrmInstanceId: null,
        optionModuleKey: null,
        optionFieldId: null,
        optionId: null,
      };
    case CrmFieldType.NUMBER:
      return {
        ...base,
        textValue: null,
        numberValue: Number(value),
        booleanValue: null,
        dateValue: null,
        datetimeValue: null,
        optionCrmInstanceId: null,
        optionModuleKey: null,
        optionFieldId: null,
        optionId: null,
      };
    case CrmFieldType.BOOLEAN:
      return {
        ...base,
        textValue: null,
        numberValue: null,
        booleanValue: Boolean(value),
        dateValue: null,
        datetimeValue: null,
        optionCrmInstanceId: null,
        optionModuleKey: null,
        optionFieldId: null,
        optionId: null,
      };
    case CrmFieldType.DATE:
      return {
        ...base,
        textValue: null,
        numberValue: null,
        booleanValue: null,
        dateValue: new Date(`${String(value)}T00:00:00.000Z`),
        datetimeValue: null,
        optionCrmInstanceId: null,
        optionModuleKey: null,
        optionFieldId: null,
        optionId: null,
      };
    case CrmFieldType.DATETIME:
      return {
        ...base,
        textValue: null,
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        datetimeValue: new Date(
          `${String(value).length === 16 ? `${String(value)}:00` : String(value)}Z`,
        ),
        optionCrmInstanceId: null,
        optionModuleKey: null,
        optionFieldId: null,
        optionId: null,
      };
    case CrmFieldType.SELECT: {
      const optionKey = String(value);
      const option = field.options.find((candidate) => candidate.key === optionKey);
      if (!option) {
        throw new Error(`The field ${field.key} has an invalid or disabled option.`);
      }
      return {
        ...base,
        textValue: null,
        numberValue: null,
        booleanValue: null,
        dateValue: null,
        datetimeValue: null,
        optionCrmInstanceId: crmInstanceId,
        optionModuleKey: moduleKey,
        optionFieldId: field.id,
        optionId: option.id,
      };
    }
    default:
      throw new Error(`Unsupported field type for custom field ${field.key}.`);
  }
}

export async function getCustomFieldValues({
  moduleKey,
  recordId,
}: {
  moduleKey: string;
  recordId: string;
}): Promise<CustomFieldDisplayValue[]> {
  const normalizedModuleKey = asModuleKey(moduleKey);
  const tenant = await getCrmTenantContext(
    MODULE_READ_PERMISSIONS[normalizedModuleKey],
  );

  const recordExists = await findOperationalRecord(
    db,
    normalizedModuleKey,
    tenant.crmId,
    recordId,
  );
  if (!recordExists) {
    throw new CustomFieldValueError(
      "The record was not found in the authorized CRM module.",
    );
  }

  const fields = await db.crmFieldDefinition.findMany({
    where: {
      crmInstanceId: tenant.crmId,
      moduleKey: normalizedModuleKey,
      origin: CrmFieldOrigin.CUSTOM,
      enabled: true,
      moduleConfiguration: {
        enabled: true,
      },
    },
    select: {
      id: true,
      key: true,
      label: true,
      fieldType: true,
      required: true,
      enabled: true,
      options: {
        select: {
          id: true,
          key: true,
          label: true,
          enabled: true,
        },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      },
    },
  });

  const values = await getPersistedCustomFieldValuesForRecord(
    normalizedModuleKey,
    tenant.crmId,
    recordId,
  );
  const valuesByFieldId = new Map(values.map((value) => [value.fieldId, value]));

  return fields.map((field) => {
    const persistedValue = valuesByFieldId.get(field.id);
    if (!persistedValue) {
      return {
        id: field.id,
        key: field.key,
        label: field.label,
        fieldType: field.fieldType,
        required: field.required,
        value: null,
        displayValue: null,
        optionKey: null,
        optionLabel: null,
        options: field.options.map((option) => ({
          key: option.key,
          label: option.label,
        })),
      };
    }

    const value = normalizePersistedCustomFieldValue(field, persistedValue);
    const optionLabel =
      persistedValue.optionId && persistedValue.optionId.length > 0
        ? field.options.find((option) => option.id === persistedValue.optionId)?.label ??
          null
        : null;

    return {
      id: field.id,
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      required: field.required,
      value,
      displayValue: formatCustomFieldDisplayValue(field.fieldType, value, optionLabel),
      optionKey:
        persistedValue.optionId && persistedValue.optionId.length > 0
          ? field.options.find((option) => option.id === persistedValue.optionId)?.key ?? null
          : null,
      optionLabel,
      options: field.options.map((option) => ({
        key: option.key,
        label: option.label,
      })),
    };
  });
}

function normalizePersistedCustomFieldValue(
  field: {
    fieldType: CrmFieldType;
    options: { id: string; key: string; label: string; enabled: boolean }[];
  },
  value: {
    fieldType: CrmFieldType;
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    dateValue: Date | null;
    datetimeValue: Date | null;
    optionId: string | null;
  },
): string | number | boolean | null {
  switch (field.fieldType) {
    case CrmFieldType.TEXT:
    case CrmFieldType.TEXTAREA:
    case CrmFieldType.EMAIL:
    case CrmFieldType.PHONE:
      return value.textValue;
    case CrmFieldType.NUMBER:
      return value.numberValue;
    case CrmFieldType.BOOLEAN:
      return value.booleanValue;
    case CrmFieldType.DATE:
      return value.dateValue ? value.dateValue.toISOString().slice(0, 10) : null;
    case CrmFieldType.DATETIME:
      return value.datetimeValue ? value.datetimeValue.toISOString().slice(0, 16) : null;
    case CrmFieldType.SELECT:
      return value.optionId ?? null;
    default:
      return null;
  }
}

function formatCustomFieldDisplayValue(
  fieldType: CrmFieldType,
  value: string | number | boolean | null,
  optionLabel: string | null,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  switch (fieldType) {
    case CrmFieldType.SELECT:
      return optionLabel ?? String(value);
    case CrmFieldType.BOOLEAN:
      return value ? "Yes" : "No";
    case CrmFieldType.DATE:
      return typeof value === "string" ? value : null;
    case CrmFieldType.DATETIME:
      return typeof value === "string" ? value : null;
    default:
      return String(value);
  }
}

async function getPersistedCustomFieldValuesForRecord(
  moduleKey: CustomValueModule,
  crmInstanceId: string,
  recordId: string,
) {
  switch (moduleKey) {
    case "companies":
      return db.customCompanyFieldValue.findMany({
        where: { crmInstanceId, recordId },
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          optionId: true,
          fieldType: true,
        },
      });
    case "contacts":
      return db.customContactFieldValue.findMany({
        where: { crmInstanceId, recordId },
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          optionId: true,
          fieldType: true,
        },
      });
    case "leads":
      return db.customLeadFieldValue.findMany({
        where: { crmInstanceId, recordId },
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          optionId: true,
          fieldType: true,
        },
      });
    case "tasks":
      return db.customTaskFieldValue.findMany({
        where: { crmInstanceId, recordId },
        select: {
          fieldId: true,
          textValue: true,
          numberValue: true,
          booleanValue: true,
          dateValue: true,
          datetimeValue: true,
          optionId: true,
          fieldType: true,
        },
      });
  }
}

function getRuntimeField(field: {
  id: string;
  key: string;
  label: string;
  fieldType: CrmFieldType;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  pattern: string | null;
  options: {
    id: string;
    crmInstanceId: string;
    moduleKey: string;
    fieldId: string;
    key: string;
    label: string;
  }[];
}): RuntimeFormField {
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    fieldType: field.fieldType,
    origin: CrmFieldOrigin.CUSTOM,
    backingColumn: null,
    required: field.required,
    displayOrder: 0,
    validation: {
      minLength: field.minLength,
      maxLength: field.maxLength,
      minValue: field.minValue,
      maxValue: field.maxValue,
      pattern: field.pattern,
    },
    options: field.options.map((option) => ({
      key: option.key,
      label: option.label,
    })),
  };
}

function toStoredColumns(
  field: RuntimeFormField,
  availableOptions: { id: string; key: string }[],
  crmInstanceId: string,
  moduleKey: CustomValueModule,
  value: string | number | boolean | null,
): StoredColumns | null {
  if (value === null) return null;

  const emptyColumns: StoredColumns = {
    textValue: null,
    numberValue: null,
    booleanValue: null,
    dateValue: null,
    datetimeValue: null,
    optionCrmInstanceId: null,
    optionModuleKey: null,
    optionFieldId: null,
    optionId: null,
  };

  switch (field.fieldType) {
    case CrmFieldType.TEXT:
    case CrmFieldType.TEXTAREA:
    case CrmFieldType.EMAIL:
    case CrmFieldType.PHONE:
      if (typeof value !== "string") break;
      return { ...emptyColumns, textValue: value };
    case CrmFieldType.NUMBER:
      if (typeof value !== "number") break;
      return { ...emptyColumns, numberValue: value };
    case CrmFieldType.BOOLEAN:
      if (typeof value !== "boolean") break;
      return { ...emptyColumns, booleanValue: value };
    case CrmFieldType.DATE:
      if (typeof value !== "string") break;
      return {
        ...emptyColumns,
        dateValue: new Date(`${value}T00:00:00.000Z`),
      };
    case CrmFieldType.DATETIME:
      if (typeof value !== "string") break;
      return {
        ...emptyColumns,
        datetimeValue: new Date(
          `${value.length === 16 ? `${value}:00` : value}Z`,
        ),
      };
    case CrmFieldType.SELECT: {
      if (typeof value !== "string") break;
      const option = availableOptions.find((candidate) => candidate.key === value);
      if (!option) {
        throw new CustomFieldValueError(
          `${field.label} has an invalid or disabled option.`,
        );
      }
      return {
        ...emptyColumns,
        optionCrmInstanceId: crmInstanceId,
        optionModuleKey: moduleKey,
        optionFieldId: field.id,
        optionId: option.id,
      };
    }
    default:
      throw new CustomFieldValueError("This custom field type is unsupported.");
  }

  throw new CustomFieldValueError(
    `${field.label} has an invalid value for its configured type.`,
  );
}

async function prepareWrite(
  transaction: PrismaTypes.TransactionClient,
  tenant: Awaited<ReturnType<typeof getCrmTenantContext>>,
  input: WriteInput,
): Promise<PreparedWrite> {
  if (!input.fieldId.trim() || !input.recordId.trim()) {
    throw new CustomFieldValueError("A record and custom field are required.");
  }

  const field = await transaction.crmFieldDefinition.findFirst({
    where: {
      id: input.fieldId,
      crmInstanceId: tenant.crmId,
      origin: CrmFieldOrigin.CUSTOM,
      enabled: true,
    },
    select: {
      id: true,
      crmInstanceId: true,
      moduleKey: true,
      key: true,
      label: true,
      fieldType: true,
      origin: true,
      required: true,
      enabled: true,
      minLength: true,
      maxLength: true,
      minValue: true,
      maxValue: true,
      pattern: true,
      moduleConfiguration: { select: { enabled: true } },
      options: {
        where: { enabled: true },
        select: {
          id: true,
          crmInstanceId: true,
          moduleKey: true,
          fieldId: true,
          key: true,
          label: true,
        },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      },
    },
  });

  if (!field || field.origin !== CrmFieldOrigin.CUSTOM || !field.enabled) {
    throw new CustomFieldValueError(
      "The custom field is unavailable in this CRM.",
    );
  }

  const moduleKey = asModuleKey(field.moduleKey);
  if (!field.moduleConfiguration.enabled) {
    throw new AuthorizationError("The CRM module is disabled.");
  }

  if (
    field.options.some(
      (option) =>
        option.crmInstanceId !== field.crmInstanceId ||
        option.moduleKey !== moduleKey ||
        option.fieldId !== field.id,
    )
  ) {
    throw new CustomFieldValueError(
      "The custom field has invalid option associations.",
    );
  }

  const permission = MODULE_PERMISSIONS[moduleKey];
  await assertCrmRolePermission(tenant.crmRole, permission);

  const runtimeField = getRuntimeField(field);
  const validation = validateCrmRuntimeForm(
    {
      key: "custom_value",
      name: "Custom value",
      description: null,
      moduleKey,
      fields: [runtimeField],
      disabledFieldKeys: [],
      rules: [],
    },
    { [runtimeField.key]: input.value },
  );
  if (!validation.valid) {
    throw new CustomFieldValueError(
      validation.errors[runtimeField.key] ?? "The custom value is invalid.",
    );
  }

  const record = await findOperationalRecord(
    transaction,
    moduleKey,
    tenant.crmId,
    input.recordId,
  );
  if (!record) {
    throw new CustomFieldValueError(
      "The record was not found in the authorized CRM module.",
    );
  }

  return {
    tenantId: tenant.crmId,
    moduleKey,
    recordId: input.recordId,
    fieldId: field.id,
    fieldType: field.fieldType,
    fieldOrigin: field.origin,
    columns: toStoredColumns(
      runtimeField,
      field.options,
      tenant.crmId,
      moduleKey,
      validation.values[runtimeField.key],
    ),
  };
}

async function findOperationalRecord(
  transaction: PrismaTypes.TransactionClient,
  moduleKey: CustomValueModule,
  crmInstanceId: string,
  recordId: string,
): Promise<boolean> {
  switch (moduleKey) {
    case "companies":
      return Boolean(
        await transaction.company.findFirst({
          where: { id: recordId, crmInstanceId },
          select: { id: true },
        }),
      );
    case "contacts":
      return Boolean(
        await transaction.contact.findFirst({
          where: { id: recordId, crmInstanceId },
          select: { id: true },
        }),
      );
    case "leads":
      return Boolean(
        await transaction.lead.findFirst({
          where: { id: recordId, crmInstanceId },
          select: { id: true },
        }),
      );
    case "tasks":
      return Boolean(
        await transaction.task.findFirst({
          where: { id: recordId, crmInstanceId },
          select: { id: true },
        }),
      );
  }
}

type ValueIdentity = {
  crmInstanceId: string;
  moduleKey: CustomValueModule;
  recordId: string;
  fieldId: string;
  fieldType: CrmFieldType;
  fieldOrigin: CrmFieldOrigin;
};

function createData(identity: ValueIdentity, columns: StoredColumns) {
  return {
    crmInstanceId: identity.crmInstanceId,
    moduleKey: identity.moduleKey,
    recordId: identity.recordId,
    fieldId: identity.fieldId,
    fieldType: identity.fieldType,
    fieldOrigin: identity.fieldOrigin,
    textValue: columns.textValue,
    numberValue: columns.numberValue,
    booleanValue: columns.booleanValue,
    dateValue: columns.dateValue,
    datetimeValue: columns.datetimeValue,
    optionCrmInstanceId: columns.optionCrmInstanceId,
    optionModuleKey: columns.optionModuleKey,
    optionFieldId: columns.optionFieldId,
    optionId: columns.optionId,
  };
}

function updateData(columns: StoredColumns) {
  return {
    textValue: columns.textValue,
    numberValue: columns.numberValue,
    booleanValue: columns.booleanValue,
    dateValue: columns.dateValue,
    datetimeValue: columns.datetimeValue,
    optionCrmInstanceId: columns.optionCrmInstanceId,
    optionModuleKey: columns.optionModuleKey,
    optionFieldId: columns.optionFieldId,
    optionId: columns.optionId,
  };
}

async function createStoredValue(
  transaction: PrismaTypes.TransactionClient,
  identity: ValueIdentity,
  columns: StoredColumns,
) {
  const data = createData(identity, columns);
  switch (identity.moduleKey) {
    case "companies":
      return transaction.customCompanyFieldValue.create({
        data,
        select: { id: true },
      });
    case "contacts":
      return transaction.customContactFieldValue.create({
        data,
        select: { id: true },
      });
    case "leads":
      return transaction.customLeadFieldValue.create({
        data,
        select: { id: true },
      });
    case "tasks":
      return transaction.customTaskFieldValue.create({
        data,
        select: { id: true },
      });
  }
}

async function updateStoredValue(
  transaction: PrismaTypes.TransactionClient,
  identity: ValueIdentity,
  valueId: string,
  columns: StoredColumns,
) {
  const where = {
    id: valueId,
    crmInstanceId: identity.crmInstanceId,
    moduleKey: identity.moduleKey,
    recordId: identity.recordId,
    fieldId: identity.fieldId,
  };
  const data = updateData(columns);
  switch (identity.moduleKey) {
    case "companies":
      return transaction.customCompanyFieldValue.updateMany({ where, data });
    case "contacts":
      return transaction.customContactFieldValue.updateMany({ where, data });
    case "leads":
      return transaction.customLeadFieldValue.updateMany({ where, data });
    case "tasks":
      return transaction.customTaskFieldValue.updateMany({ where, data });
  }
}

async function upsertStoredValue(
  transaction: PrismaTypes.TransactionClient,
  identity: ValueIdentity,
  columns: StoredColumns,
) {
  const where = {
    crmInstanceId_moduleKey_recordId_fieldId: {
      crmInstanceId: identity.crmInstanceId,
      moduleKey: identity.moduleKey,
      recordId: identity.recordId,
      fieldId: identity.fieldId,
    },
  };
  const create = createData(identity, columns);
  const update = updateData(columns);
  switch (identity.moduleKey) {
    case "companies":
      return transaction.customCompanyFieldValue.upsert({
        where,
        create,
        update,
        select: { id: true },
      });
    case "contacts":
      return transaction.customContactFieldValue.upsert({
        where,
        create,
        update,
        select: { id: true },
      });
    case "leads":
      return transaction.customLeadFieldValue.upsert({
        where,
        create,
        update,
        select: { id: true },
      });
    case "tasks":
      return transaction.customTaskFieldValue.upsert({
        where,
        create,
        update,
        select: { id: true },
      });
  }
}

async function deleteStoredValue(
  transaction: PrismaTypes.TransactionClient,
  identity: ValueIdentity,
  valueId?: string,
) {
  const where = {
    ...(valueId ? { id: valueId } : {}),
    crmInstanceId: identity.crmInstanceId,
    moduleKey: identity.moduleKey,
    recordId: identity.recordId,
    fieldId: identity.fieldId,
  };
  switch (identity.moduleKey) {
    case "companies":
      return transaction.customCompanyFieldValue.deleteMany({ where });
    case "contacts":
      return transaction.customContactFieldValue.deleteMany({ where });
    case "leads":
      return transaction.customLeadFieldValue.deleteMany({ where });
    case "tasks":
      return transaction.customTaskFieldValue.deleteMany({ where });
  }
}

function identityFrom(prepared: PreparedWrite): ValueIdentity {
  return {
    crmInstanceId: prepared.tenantId,
    moduleKey: prepared.moduleKey,
    recordId: prepared.recordId,
    fieldId: prepared.fieldId,
    fieldType: prepared.fieldType,
    fieldOrigin: prepared.fieldOrigin,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createCustomFieldValue(input: WriteInput) {
  const tenant = await getCrmTenantContext();
  try {
    return await db.$transaction(async (transaction) => {
      const prepared = await prepareWrite(transaction, tenant, input);
      if (!prepared.columns) {
        throw new CustomFieldValueError(
          "An empty optional value cannot be created.",
        );
      }
      const value = await createStoredValue(
        transaction,
        identityFrom(prepared),
        prepared.columns,
      );
      return { id: value.id };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new CustomFieldValueConflictError(
        "A value already exists for this record and custom field.",
      );
    }
    throw error;
  }
}

export async function updateCustomFieldValue(input: UpdateInput) {
  const tenant = await getCrmTenantContext();
  return db.$transaction(async (transaction) => {
    const prepared = await prepareWrite(transaction, tenant, input);
    const identity = identityFrom(prepared);
    if (!prepared.columns) {
      const result = await deleteStoredValue(
        transaction,
        identity,
        input.valueId,
      );
      if (result.count !== 1) {
        throw new CustomFieldValueError(
          "The custom field value was not found in this CRM record.",
        );
      }
      return { id: null };
    }

    const result = await updateStoredValue(
      transaction,
      identity,
      input.valueId,
      prepared.columns,
    );
    if (result.count !== 1) {
      throw new CustomFieldValueError(
        "The custom field value was not found in this CRM record.",
      );
    }
    return { id: input.valueId };
  });
}

export async function upsertCustomFieldValue(input: WriteInput) {
  const tenant = await getCrmTenantContext();
  return db.$transaction(async (transaction) => {
    const prepared = await prepareWrite(transaction, tenant, input);
    const identity = identityFrom(prepared);
    if (!prepared.columns) {
      await deleteStoredValue(transaction, identity);
      return { id: null };
    }
    const value = await upsertStoredValue(
      transaction,
      identity,
      prepared.columns,
    );
    return { id: value.id };
  });
}

export async function deleteCustomFieldValue(input: DeleteInput) {
  const tenant = await getCrmTenantContext();
  return db.$transaction(async (transaction) => {
    const field = await transaction.crmFieldDefinition.findFirst({
      where: {
        id: input.fieldId,
        crmInstanceId: tenant.crmId,
        origin: CrmFieldOrigin.CUSTOM,
      },
      select: {
        id: true,
        moduleKey: true,
        fieldType: true,
        origin: true,
        moduleConfiguration: { select: { enabled: true } },
      },
    });
    if (!field) {
      throw new CustomFieldValueError(
        "The custom field is unavailable in this CRM.",
      );
    }
    const moduleKey = asModuleKey(field.moduleKey);
    if (!field.moduleConfiguration.enabled) {
      throw new AuthorizationError("The CRM module is disabled.");
    }
    await assertCrmRolePermission(
      tenant.crmRole,
      MODULE_PERMISSIONS[moduleKey],
    );
    const recordFound = await findOperationalRecord(
      transaction,
      moduleKey,
      tenant.crmId,
      input.recordId,
    );
    if (!recordFound) {
      throw new CustomFieldValueError(
        "The record was not found in the authorized CRM module.",
      );
    }
    const result = await deleteStoredValue(
      transaction,
      {
        crmInstanceId: tenant.crmId,
        moduleKey,
        recordId: input.recordId,
        fieldId: field.id,
        fieldType: field.fieldType,
        fieldOrigin: field.origin,
      },
      input.valueId,
    );
    if (result.count !== 1) {
      throw new CustomFieldValueError(
        "The custom field value was not found in this CRM record.",
      );
    }
    return { deleted: true };
  });
}
