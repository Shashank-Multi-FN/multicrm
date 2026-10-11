import { CrmRole, MembershipRole } from "@prisma/client/index";

export function crmRoleForOrganizationRole(role: MembershipRole): CrmRole {
  switch (role) {
    case MembershipRole.ORG_OWNER:
      return CrmRole.CRM_OWNER;
    case MembershipRole.ORG_ADMIN:
      return CrmRole.CRM_ADMIN;
    case MembershipRole.ORG_MEMBER:
      return CrmRole.CRM_MEMBER;
  }
}
