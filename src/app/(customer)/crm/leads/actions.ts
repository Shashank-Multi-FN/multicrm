"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCrmTenantContext } from "@/lib/crm/context";

type FormState = {
  error?: string;
};

function getValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export async function createLead(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const { crmId } = await getCrmTenantContext();

    const firstName = getValue(formData, "firstName");
    const lastName = getValue(formData, "lastName");
    const email = getValue(formData, "email");
    const phone = getValue(formData, "phone");
    const jobTitle = getValue(formData, "jobTitle");
    const source = getValue(formData, "source");
    const status = getValue(formData, "status");
    const companyId = getValue(formData, "companyId");

    if (!firstName || !lastName) {
      return {
        error: "First name and last name are required.",
      };
    }

    if (companyId) {
      const company = await db.company.findFirst({
        where: {
          id: companyId,
          crmInstanceId: crmId,
        },
        select: {
          id: true,
        },
      });

      if (!company) {
        return {
          error: "Selected company was not found.",
        };
      }
    }

    await db.lead.create({
      data: {
        crmInstanceId: crmId,
        companyId: companyId || null,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        jobTitle: jobTitle || null,
        source: source || null,
        status: status || null,
      },
    });

    revalidatePath("/crm/leads");
  } catch {
    return {
      error: "Unable to create lead.",
    };
  }

  redirect("/crm/leads");
}

export async function updateLead(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const { crmId } = await getCrmTenantContext();

    const id = getValue(formData, "id");
    const firstName = getValue(formData, "firstName");
    const lastName = getValue(formData, "lastName");
    const email = getValue(formData, "email");
    const phone = getValue(formData, "phone");
    const jobTitle = getValue(formData, "jobTitle");
    const source = getValue(formData, "source");
    const status = getValue(formData, "status");
    const companyId = getValue(formData, "companyId");

    if (!id) {
      return {
        error: "Lead ID is required.",
      };
    }

    if (!firstName || !lastName) {
      return {
        error: "First name and last name are required.",
      };
    }

    const existingLead = await db.lead.findFirst({
      where: {
        id,
        crmInstanceId: crmId,
      },
      select: {
        id: true,
      },
    });

    if (!existingLead) {
      return {
        error: "Lead not found.",
      };
    }

    if (companyId) {
      const company = await db.company.findFirst({
        where: {
          id: companyId,
          crmInstanceId: crmId,
        },
        select: {
          id: true,
        },
      });

      if (!company) {
        return {
          error: "Selected company was not found.",
        };
      }
    }

    await db.lead.update({
      where: {
        id: existingLead.id,
      },
      data: {
        companyId: companyId || null,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
        jobTitle: jobTitle || null,
        source: source || null,
        status: status || null,
      },
    });

    revalidatePath("/crm/leads");
    revalidatePath(`/crm/leads/${id}`);
  } catch {
    return {
      error: "Unable to update lead.",
    };
  }

  redirect("/crm/leads");
}

export async function deleteLead(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const { crmId } = await getCrmTenantContext();

    const id = getValue(formData, "id");

    if (!id) {
      return {
        error: "Lead ID is required.",
      };
    }

    const existingLead = await db.lead.findFirst({
      where: {
        id,
        crmInstanceId: crmId,
      },
      select: {
        id: true,
      },
    });

    if (!existingLead) {
      return {
        error: "Lead not found.",
      };
    }

    await db.lead.delete({
      where: {
        id: existingLead.id,
      },
    });

    revalidatePath("/crm/leads");
  } catch {
    return {
      error: "Unable to delete lead.",
    };
  }

  redirect("/crm/leads");
}