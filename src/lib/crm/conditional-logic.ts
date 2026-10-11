export type ConditionalFieldType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "EMAIL"
  | "PHONE"
  | "DATE"
  | "DATETIME"
  | "BOOLEAN"
  | "SELECT";

export type ConditionalOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY";

export type ConditionalAction =
  | "SHOW"
  | "HIDE"
  | "REQUIRE"
  | "OPTIONAL"
  | "ENABLE"
  | "DISABLE";

export type ConditionalRule = {
  sourceFieldKey: string;
  sourceFieldType: ConditionalFieldType;
  operator: ConditionalOperator;
  comparisonValue: string | null;
  targetFieldKey: string;
  action: ConditionalAction;
  enabled?: boolean;
};

export type ConditionalField = {
  id: string;
  key: string;
  fieldType: ConditionalFieldType;
  required: boolean;
};

export type ConditionalFieldState = {
  visible: boolean;
  enabled: boolean;
  required: boolean;
  conditionallyRequired: boolean;
};

export type ConditionalRuleFieldMetadata = {
  id: string;
  key: string;
  crmInstanceId: string;
  moduleKey: string;
  fieldType: ConditionalFieldType;
  enabled: boolean;
  options: { key: string; enabled: boolean }[];
};

export class ConditionalRuleValidationError extends Error {}

const OPERATORS: readonly ConditionalOperator[] = [
  "EQUALS",
  "NOT_EQUALS",
  "IS_EMPTY",
  "IS_NOT_EMPTY",
];
const ACTIONS: readonly ConditionalAction[] = [
  "SHOW",
  "HIDE",
  "REQUIRE",
  "OPTIONAL",
  "ENABLE",
  "DISABLE",
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

function validDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validDateTime(value: string): boolean {
  if (!ISO_DATETIME.test(value)) return false;
  const [date, time] = value.split("T");
  if (!validDate(date)) return false;
  const [hours, minutes, seconds = "00"] = time.split(":");
  const secondValue = Number(seconds);
  return (
    Number(hours) <= 23 &&
    Number(minutes) <= 59 &&
    secondValue >= 0 &&
    secondValue < 60
  );
}

function canonicalDateTime(value: string): string | null {
  if (!validDateTime(value)) return null;
  const [date, time] = value.split("T");
  const [hours, minutes, rawSeconds = "00"] = time.split(":");
  const [seconds, fraction] = rawSeconds.split(".");
  return `${date}T${hours}:${minutes}:${seconds.padStart(2, "0")}.${(fraction ?? "").padEnd(3, "0")}`;
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0)
  );
}

function comparableValue(
  fieldType: ConditionalFieldType,
  value: unknown,
): string | number | boolean | null {
  if (isEmpty(value)) return null;

  switch (fieldType) {
    case "NUMBER": {
      if (typeof value !== "string" && typeof value !== "number") return null;
      const number = typeof value === "number" ? value : Number(value);
      return Number.isFinite(number) ? number : null;
    }
    case "BOOLEAN":
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return null;
    case "TEXT":
    case "TEXTAREA":
    case "EMAIL":
    case "PHONE":
    case "DATE":
    case "SELECT":
      return typeof value === "string" ? value : null;
    case "DATETIME":
      return typeof value === "string" ? canonicalDateTime(value) : null;
  }
}

function normalizedComparisonValue(
  sourceField: ConditionalRuleFieldMetadata,
  operator: ConditionalOperator,
  actionValue: string | null,
): string | null {
  if (operator === "IS_EMPTY" || operator === "IS_NOT_EMPTY") {
    if (actionValue !== null && actionValue !== "") {
      throw new ConditionalRuleValidationError(
        "Empty-value operators cannot have a comparison value.",
      );
    }
    return null;
  }

  if (actionValue === null || actionValue.length === 0) {
    throw new ConditionalRuleValidationError(
      "Choose a comparison value for this operator.",
    );
  }
  if (actionValue.length > 1000) {
    throw new ConditionalRuleValidationError(
      "Comparison values must be 1000 characters or fewer.",
    );
  }

  switch (sourceField.fieldType) {
    case "TEXT":
    case "TEXTAREA":
    case "EMAIL":
    case "PHONE":
      return actionValue;
    case "NUMBER": {
      const number = Number(actionValue);
      if (actionValue.trim() === "" || !Number.isFinite(number)) {
        throw new ConditionalRuleValidationError(
          "Enter a valid numeric comparison value.",
        );
      }
      return String(number);
    }
    case "BOOLEAN":
      if (actionValue !== "true" && actionValue !== "false") {
        throw new ConditionalRuleValidationError(
          "Boolean comparisons must be true or false.",
        );
      }
      return actionValue;
    case "DATE":
      if (!validDate(actionValue)) {
        throw new ConditionalRuleValidationError(
          "Enter a valid date comparison value.",
        );
      }
      return actionValue;
    case "DATETIME":
      if (!validDateTime(actionValue)) {
        throw new ConditionalRuleValidationError(
          "Enter a valid date and time comparison value.",
        );
      }
      return canonicalDateTime(actionValue);
    case "SELECT":
      if (!sourceField.options.some(
        (option) => option.enabled && option.key === actionValue,
      )) {
        throw new ConditionalRuleValidationError(
          "Select an enabled option belonging to the source field.",
        );
      }
      return actionValue;
  }
}

export function normalizeConditionalComparisonValue(
  sourceField: ConditionalRuleFieldMetadata,
  rawOperator: string,
  comparisonValue: string | null,
): string | null {
  if (!OPERATORS.includes(rawOperator as ConditionalOperator)) {
    throw new ConditionalRuleValidationError(
      "Choose a supported condition operator.",
    );
  }
  return normalizedComparisonValue(
    sourceField,
    rawOperator as ConditionalOperator,
    comparisonValue,
  );
}

export function conditionalRuleMatches(
  rule: ConditionalRule,
  sourceField: Pick<ConditionalField, "key" | "fieldType">,
  values: Record<string, unknown>,
): boolean {
  if (
    rule.enabled === false ||
    sourceField.key !== rule.sourceFieldKey ||
    sourceField.fieldType !== rule.sourceFieldType
  ) {
    return false;
  }

  let sourceValue = values[rule.sourceFieldKey];
  if (sourceField.fieldType === "BOOLEAN" && sourceValue === undefined) {
    sourceValue = false;
  }
  const empty = isEmpty(sourceValue);
  if (rule.operator === "IS_EMPTY") return empty;
  if (rule.operator === "IS_NOT_EMPTY") return !empty;
  if (empty || rule.comparisonValue === null) return false;

  const actual = comparableValue(sourceField.fieldType, sourceValue);
  const expected = comparableValue(
    sourceField.fieldType,
    rule.comparisonValue,
  );
  if (actual === null || expected === null) return false;
  return rule.operator === "EQUALS"
    ? actual === expected
    : actual !== expected;
}

export function validateConditionalRuleDefinition({
  crmInstanceId,
  moduleKey,
  formFieldIds,
  sourceField,
  targetField,
  operator: rawOperator,
  comparisonValue,
  action: rawAction,
}: {
  crmInstanceId: string;
  moduleKey: string;
  formFieldIds: readonly string[];
  sourceField: ConditionalRuleFieldMetadata;
  targetField: ConditionalRuleFieldMetadata;
  operator: string;
  comparisonValue: string | null;
  action: string;
}): Omit<ConditionalRule, "enabled"> {
  if (!OPERATORS.includes(rawOperator as ConditionalOperator)) {
    throw new ConditionalRuleValidationError("Choose a supported condition operator.");
  }
  if (!ACTIONS.includes(rawAction as ConditionalAction)) {
    throw new ConditionalRuleValidationError("Choose a supported conditional action.");
  }
  if (
    sourceField.crmInstanceId !== crmInstanceId ||
    targetField.crmInstanceId !== crmInstanceId ||
    sourceField.moduleKey !== moduleKey ||
    targetField.moduleKey !== moduleKey
  ) {
    throw new ConditionalRuleValidationError(
      "Condition fields must belong to this CRM module.",
    );
  }
  if (
    !formFieldIds.includes(sourceField.id) ||
    !formFieldIds.includes(targetField.id)
  ) {
    throw new ConditionalRuleValidationError(
      "Condition fields must be attached to this form.",
    );
  }
  if (!sourceField.enabled || !targetField.enabled) {
    throw new ConditionalRuleValidationError(
      "Condition source and target fields must be enabled.",
    );
  }
  if (sourceField.id === targetField.id) {
    throw new ConditionalRuleValidationError(
      "A field cannot control itself.",
    );
  }

  const operator = rawOperator as ConditionalOperator;
  const action = rawAction as ConditionalAction;

  return {
    sourceFieldKey: sourceField.key,
    sourceFieldType: sourceField.fieldType,
    operator,
    comparisonValue: normalizedComparisonValue(
      sourceField,
      operator,
      comparisonValue,
    ),
    targetFieldKey: targetField.key,
    action,
  };
}

export function evaluateConditionalFieldStates(
  fields: readonly ConditionalField[],
  rules: readonly ConditionalRule[],
  values: Record<string, unknown>,
): Record<string, ConditionalFieldState> {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const matchingRules = new Map<string, ConditionalAction[]>();
  const configuredActions = new Map<string, ConditionalAction[]>();

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const targetActions = configuredActions.get(rule.targetFieldKey) ?? [];
    targetActions.push(rule.action);
    configuredActions.set(rule.targetFieldKey, targetActions);
    const sourceField = fieldsByKey.get(rule.sourceFieldKey);
    if (!sourceField) continue;

    if (conditionalRuleMatches(rule, sourceField, values)) {
      const actions = matchingRules.get(rule.targetFieldKey) ?? [];
      actions.push(rule.action);
      matchingRules.set(rule.targetFieldKey, actions);
    }
  }

  return Object.fromEntries(
    fields.map((field) => {
      const actions = matchingRules.get(field.key) ?? [];
      const configured = configuredActions.get(field.key) ?? [];
      const visible = actions.includes("HIDE")
        ? false
        : actions.includes("SHOW") || !configured.includes("SHOW");
      const enabled = actions.includes("DISABLE")
        ? false
        : actions.includes("ENABLE") || !configured.includes("ENABLE");
      const conditionallyRequired =
        visible &&
        enabled &&
        actions.includes("REQUIRE") &&
        !actions.includes("OPTIONAL");
      return [
        field.key,
        {
          visible,
          enabled,
          required: visible && enabled && (field.required || conditionallyRequired),
          conditionallyRequired,
        },
      ];
    }),
  );
}
