export function getRolePermissions(role) {
  const normalizedRole = role || "staff";

  if (normalizedRole === "owner") {
    return {
      canViewFullDashboard: true,
      canViewReports: true,
      canManageCategories: true,
      canManageUsers: true,
      canAddTransactions: true,
      canEditTransactions: true,
      canDeleteTransactions: true,
      canManageSavings: true,
      canManageTargets: true,
    };
  }

  if (normalizedRole === "manager") {
    return {
      canViewFullDashboard: true,
      canViewReports: true,
      canManageCategories: true,
      canManageUsers: false,
      canAddTransactions: true,
      canEditTransactions: true,
      canDeleteTransactions: true,
      canManageSavings: true,
      canManageTargets: false,
    };
  }

  return {
    canViewFullDashboard: false,
    canViewReports: false,
    canManageCategories: false,
    canManageUsers: false,
    canAddTransactions: true,
    canEditTransactions: false,
    canDeleteTransactions: false,
    canManageSavings: false,
    canManageTargets: false,
  };
}
