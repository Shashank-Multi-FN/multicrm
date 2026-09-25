"use server";

import { revalidatePath } from "next/cache";
import { getCrmTenantContext } from "@/lib/crm/context";
import { AuthorizationError } from "@/lib/auth/errors";
import { db } from "@/lib/db";

export type CompanyFormState = {
  error?: string;
  success?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_LIMIT = 200;

function readOptionalField(formData: FormData, field: string): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value.length > 0 ? value : null;
}

function validateCompanyFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = readOptionalField(formData, "email");
  const phone = readOptionalField(formData, "phone");
  const website = readOptionalField(formData, "website");
  const industry = readOptionalField(formData, "industry");
  const status = readOptionalField(formData, "status");

  if (name.length < 2 || name.length > FIELD_LIMIT) {
    return { error: "Company name must be between 2 and 200 characters." };
  }

  if (email && (email.length > FIELD_LIMIT || !EMAIL_PATTERN.test(email))) {
    return { error: "Enter a valid email address." };
  }

  for (const [label, value] of [
    ["Phone", phone],
    ["Website", website],
    ["Industry", industry],
    ["Status", status],
  ] as const) {
    if (value && value.length > FIELD_LIMIT) {
      return { error: `${label} must be 200 characters or fewer.` };
    }
  }

  return {
    data: {
      name,
      email,
      phone,
      website,
      industry,
      status,
    },
  };
}

function genericDatabaseError(action: string, error: unknown): CompanyFormState {
  console.error(`Company ${action} failed.`, error);
  return { error: `Unable to ${action} the company right now.` };
}

export async function createCompany(
  _previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  try {
    const tenant = await getCrmTenantContext();
    const fields = validateCompanyFields(formData);

    if ("error" in fields) {
      return fields;
    }

    await db.company.create({
      data: {
        crmInstanceId: tenant.crmId,
        ...fields.data,
      },
    });

    revalidatePath("/crm/companies");
    return { success: "Company created successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to create companies." };
    }

    return genericDatabaseError("create", error);
  }
}

export async function updateCompany(
  _previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  try {
    const tenant = await getCrmTenantContext();
    const companyId = String(formData.get("companyId") ?? "").trim();

    if (!companyId) {
      return { error: "Company could not be identified." };
    }

    const fields = validateCompanyFields(formData);

    if ("error" in fields) {
      return fields;
    }

    const result = await db.company.updateMany({
      where: {
        id: companyId,
        crmInstanceId: tenant.crmId,
      },
      data: fields.data,
    });

    if (result.count !== 1) {
      return { error: "Company could not be found." };
    }

    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${companyId}`);
    return { success: "Company updated successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to update companies." };
    }

    return genericDatabaseError("update", error);
  }
}

export async function deleteCompany(
  _previousState: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  try {
    const tenant = await getCrmTenantContext();
    const companyId = String(formData.get("companyId") ?? "").trim();

    if (!companyId) {
      return { error: "Company could not be identified." };
    }

    const result = await db.company.deleteMany({
      where: {
        id: companyId,
        crmInstanceId: tenant.crmId,
      },
    });

    if (result.count !== 1) {
      return { error: "Company could not be found." };
    }

    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${companyId}`);
    return { success: "Company deleted successfully." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { error: "You are not authorized to delete companies." };
    }

    return genericDatabaseError("delete", error);
  }
}
