import {
  CrmFieldOrigin,
  CrmFieldType,
  Prisma,
} from "@prisma/client/index";

const SYSTEM_FIELDS = [
  ["companies", "name", "Name", CrmFieldType.TEXT, "name", true],
  ["companies", "email", "Email", CrmFieldType.EMAIL, "email", false],
  ["companies", "phone", "Phone", CrmFieldType.PHONE, "phone", false],
  ["companies", "website", "Website", CrmFieldType.TEXT, "website", false],
  ["companies", "industry", "Industry", CrmFieldType.TEXT, "industry", false],
  ["companies", "status", "Status", CrmFieldType.TEXT, "status", false],
  ["contacts", "first_name", "First name", CrmFieldType.TEXT, "firstName", true],
  ["contacts", "last_name", "Last name", CrmFieldType.TEXT, "lastName", true],
  ["contacts", "email", "Email", CrmFieldType.EMAIL, "email", false],
  ["contacts", "phone", "Phone", CrmFieldType.PHONE, "phone", false],
  ["contacts", "job_title", "Job title", CrmFieldType.TEXT, "jobTitle", false],
  ["contacts", "status", "Status", CrmFieldType.TEXT, "status", false],
  ["leads", "first_name", "First name", CrmFieldType.TEXT, "firstName", true],
  ["leads", "last_name", "Last name", CrmFieldType.TEXT, "lastName", true],
  ["leads", "email", "Email", CrmFieldType.EMAIL, "email", false],
  ["leads", "phone", "Phone", CrmFieldType.PHONE, "phone", false],
  ["leads", "job_title", "Job title", CrmFieldType.TEXT, "jobTitle", false],
  ["leads", "source", "Source", CrmFieldType.TEXT, "source", false],
  ["leads", "status", "Status", CrmFieldType.SELECT, "status", false],
  ["tasks", "title", "Title", CrmFieldType.TEXT, "title", true],
  ["tasks", "description", "Description", CrmFieldType.TEXTAREA, "description", false],
  ["tasks", "due_date", "Due date", CrmFieldType.DATETIME, "dueDate", false],
  ["tasks", "priority", "Priority", CrmFieldType.SELECT, "priority", false],
  ["tasks", "status", "Status", CrmFieldType.SELECT, "status", true],
] as const;

const SYSTEM_FORMS = [
  ["companies", "company_create", "Create company"],
  ["companies", "company_edit", "Edit company"],
  ["contacts", "contact_create", "Create contact"],
  ["contacts", "contact_edit", "Edit contact"],
  ["leads", "lead_create", "Create lead"],
  ["leads", "lead_edit", "Edit lead"],
  ["tasks", "task_create", "Create task"],
  ["tasks", "task_edit", "Edit task"],
] as const;

const SYSTEM_SELECT_OPTIONS = [
  ["leads", "status", "NEW", "New"],
  ["leads", "status", "CONTACTED", "Contacted"],
  ["leads", "status", "QUALIFIED", "Qualified"],
  ["leads", "status", "CONVERTED", "Converted"],
  ["leads", "status", "LOST", "Lost"],
  ["tasks", "priority", "LOW", "Low"],
  ["tasks", "priority", "MEDIUM", "Medium"],
  ["tasks", "priority", "HIGH", "High"],
  ["tasks", "status", "TODO", "To do"],
  ["tasks", "status", "IN_PROGRESS", "In progress"],
  ["tasks", "status", "COMPLETED", "Completed"],
] as const;

export async function provisionDefaultCrmFieldsAndForms(
  transaction: Prisma.TransactionClient,
  crmInstanceId: string,
): Promise<void> {
  const displayOrderByModule = new Map<string, number>();
  await transaction.crmFieldDefinition.createMany({
    data: SYSTEM_FIELDS.map(
      ([moduleKey, key, label, fieldType, backingColumn, required]) => {
        const displayOrder = displayOrderByModule.get(moduleKey) ?? 0;
        displayOrderByModule.set(moduleKey, displayOrder + 1);
        return {
          crmInstanceId,
          moduleKey,
          key,
          label,
          fieldType,
          origin: CrmFieldOrigin.SYSTEM,
          backingColumn,
          required,
          displayOrder,
        };
      },
    ),
  });

  await transaction.crmForm.createMany({
    data: SYSTEM_FORMS.map(([moduleKey, key, name]) => ({
      crmInstanceId,
      moduleKey,
      key,
      name,
    })),
  });

  const [fields, forms] = await Promise.all([
    transaction.crmFieldDefinition.findMany({
      where: { crmInstanceId },
      select: {
        id: true,
        moduleKey: true,
        key: true,
        displayOrder: true,
      },
    }),
    transaction.crmForm.findMany({
      where: { crmInstanceId },
      select: {
        id: true,
        moduleKey: true,
      },
    }),
  ]);

  const fieldByIdentity = new Map(
    fields.map((field) => [`${field.moduleKey}:${field.key}`, field]),
  );
  await transaction.crmFieldOption.createMany({
    data: SYSTEM_SELECT_OPTIONS.map(
      ([moduleKey, fieldKey, key, label], sortOrder) => {
        const field = fieldByIdentity.get(`${moduleKey}:${fieldKey}`);
        if (!field) {
          throw new Error(`Missing system field ${moduleKey}:${fieldKey}`);
        }
        return {
          crmInstanceId,
          moduleKey,
          fieldId: field.id,
          key,
          label,
          sortOrder,
        };
      },
    ),
  });

  await transaction.crmFormField.createMany({
    data: forms.flatMap((form) =>
      fields
        .filter((field) => field.moduleKey === form.moduleKey)
        .map((field) => ({
          crmInstanceId,
          moduleKey: form.moduleKey,
          formId: form.id,
          fieldId: field.id,
          displayOrder: field.displayOrder,
        })),
    ),
  });
}
