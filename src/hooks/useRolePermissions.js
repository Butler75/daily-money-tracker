import { useMemo } from "react";
import { useAppData } from "../context/AppDataContext";
import { getRolePermissions } from "../lib/permissions";

export function useRolePermissions() {
  const { profile } = useAppData();
  return useMemo(
    () => ({
      role: profile?.role || "staff",
      ...getRolePermissions(profile?.role),
    }),
    [profile?.role]
  );
}
