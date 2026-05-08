import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CATEGORIES } from "../constants";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { isDateInPeriod } from "../lib/date";
import { useToast } from "./ToastContext";

const AppDataContext = createContext(null);
const SURPLUS_SETTINGS_KEY = "daily-money-tracker-surplus-settings";
const SYSTEM_ALERT_GOAL_NAME = "System Surplus Alerts";

const DEFAULT_SURPLUS_TARGETS = {
  dailyTarget: 0,
  weeklyTarget: 0,
  monthlyTarget: 0,
  customPoints: [],
};

function summarize(records) {
  const income = records
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = records
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { income, expenses, balance: income - expenses };
}

function calculateSurplus(transactions, period) {
  return summarize(transactions.filter((item) => isDateInPeriod(item.transaction_at, period))).balance;
}

function formatAedAmount(value) {
  return new Intl.NumberFormat("en-AE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseSurplusTargets(raw) {
  if (!raw) return DEFAULT_SURPLUS_TARGETS;
  try {
    const parsed = JSON.parse(raw);
    return {
      dailyTarget: Number(parsed.dailyTarget || 0),
      weeklyTarget: Number(parsed.weeklyTarget || 0),
      monthlyTarget: Number(parsed.monthlyTarget || 0),
      customPoints: Array.isArray(parsed.customPoints)
        ? parsed.customPoints.map((point) => Number(point)).filter((point) => point > 0)
        : [],
    };
  } catch {
    return DEFAULT_SURPLUS_TARGETS;
  }
}

async function ensureProfile(user) {
  const userEmail = (user.email || "").toLowerCase();
  let invitedRole = "staff";

  if (userEmail) {
    const { data: invite } = await supabase
      .from("staff_invites")
      .select("*")
      .eq("email", userEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (invite?.role) {
      invitedRole = invite.role;
      await supabase
        .from("staff_invites")
        .update({ status: "accepted", accepted_by: user.id, accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    if (!existing.email && userEmail) {
      const { data: withEmail } = await supabase
        .from("profiles")
        .update({ email: userEmail })
        .eq("id", user.id)
        .select()
        .maybeSingle();
      if (withEmail) existing.email = withEmail.email;
    }
    if (!existing.is_active) {
      const { data: reactivated } = await supabase
        .from("profiles")
        .update({ is_active: true })
        .eq("id", user.id)
        .select()
        .single();
      return reactivated || existing;
    }
    return existing;
  }

  const payload = {
    id: user.id,
    email: userEmail,
    full_name: user.user_metadata?.full_name || "",
    role: invitedRole,
    is_active: true,
  };

  const profileInsert = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (!profileInsert.error) return profileInsert.data;

  const fallbackPayload = {
    id: user.id,
    full_name: user.user_metadata?.full_name || "",
    role: invitedRole,
    is_active: true,
  };
  const fallbackInsert = await supabase
    .from("profiles")
    .upsert(fallbackPayload, { onConflict: "id" })
    .select()
    .single();

  if (fallbackInsert.error) throw fallbackInsert.error;
  return fallbackInsert.data;
}

async function ensureDefaultCategories(userId) {
  const ownerScoped = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId);
  const fallback = await supabase
    .from("categories")
    .select("*");

  const source = ownerScoped.error ? fallback : ownerScoped;
  const existingCategories = source.data || [];
  const hasUserScopedCategories = !ownerScoped.error;
  const allowedNames = new Set(DEFAULT_CATEGORIES.map((item) => item.name));

  const categoriesToDelete = existingCategories
    .filter((item) => !allowedNames.has(item.name))
    .map((item) => item.id);

  if (categoriesToDelete.length > 0) {
    await supabase.from("categories").delete().in("id", categoriesToDelete);
  }

  const categories = DEFAULT_CATEGORIES.map((item) =>
    hasUserScopedCategories
      ? { ...item, user_id: userId }
      : { ...item }
  );

  const upsertResult = await supabase
    .from("categories")
    .upsert(categories, { onConflict: "name" });

  if (upsertResult.error && hasUserScopedCategories) {
    const withoutOwner = DEFAULT_CATEGORIES.map((item) => ({ ...item }));
    await supabase.from("categories").upsert(withoutOwner, { onConflict: "name" });
  }
}

export function AppDataProvider({ children }) {
  const { user, isConfigured } = useAuth();
  const { addToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dashboardTotals, setDashboardTotals] = useState(null);
  const [savingGoals, setSavingGoals] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [staffInvites, setStaffInvites] = useState([]);
  const [surplusTargets, setSurplusTargets] = useState(DEFAULT_SURPLUS_TARGETS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seenToastAlertIdsRef = useRef(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(SURPLUS_SETTINGS_KEY);
    setSurplusTargets(parseSurplusTargets(stored));
  }, []);

  const loadSavingsData = useCallback(async () => {
    if (!user || !isConfigured) return;

    const [goalsResult, alertsResult] = await Promise.all([
      supabase.from("saving_goals").select("*").order("created_at", { ascending: false }),
      supabase.from("alerts").select("*").order("created_at", { ascending: false }),
    ]);

    if (!goalsResult.error) setSavingGoals(goalsResult.data || []);
    if (!alertsResult.error) setAlerts(alertsResult.data || []);
  }, [isConfigured, user]);

  const loadData = useCallback(async () => {
    if (!user || !isConfigured) return;

    setLoading(true);
    setError("");

    try {
      const userProfile = await ensureProfile(user);
      if (userProfile?.is_active === false) {
        setProfile(userProfile);
        setCategories([]);
        setTransactions([]);
        setProfiles([]);
        setDashboardTotals(null);
        setError("Your account is inactive. Please contact the owner.");
        addToast("Account inactive. Contact owner for access.", "warning");
        await supabase.auth.signOut();
        return;
      }
      await ensureDefaultCategories(user.id);

      const ownerCategoryQuery = supabase
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      const fallbackCategoryQuery = supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });

      const [categoriesResult, transactionsResult, usersResult, totalsResult, invitesResult] = await Promise.all([
        ownerCategoryQuery,
        supabase
          .from("transactions")
          .select("*, category:categories(name,type)")
          .order("transaction_at", { ascending: false }),
        supabase.from("profiles").select("*").order("full_name", { ascending: true }),
        supabase.rpc("dashboard_totals"),
        supabase.from("staff_invites").select("*").order("created_at", { ascending: false }),
      ]);

      let resolvedCategories = categoriesResult;
      if (categoriesResult.error) {
        resolvedCategories = await fallbackCategoryQuery;
      }

      if (resolvedCategories.error) throw resolvedCategories.error;
      const transactionPermissionError = transactionsResult.error?.code === "42501";
      const usersPermissionError = usersResult.error?.code === "42501";
      if (transactionsResult.error && !transactionPermissionError) throw transactionsResult.error;
      if (usersResult.error && !usersPermissionError) throw usersResult.error;

      setProfile(userProfile);
      setCategories(resolvedCategories.data || []);
      setTransactions(transactionPermissionError ? [] : transactionsResult.data || []);
      setDashboardTotals(totalsResult.error ? null : totalsResult.data?.[0] || null);
      setProfiles(usersPermissionError ? [] : usersResult.data || []);
      setStaffInvites(invitesResult.error ? [] : invitesResult.data || []);
      await loadSavingsData();
    } catch (err) {
      setError(err.message || "Failed to load app data");
    } finally {
      setLoading(false);
    }
  }, [addToast, isConfigured, loadSavingsData, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    alerts
      .filter((item) => !item.is_read)
      .forEach((item) => {
        if (seenToastAlertIdsRef.current.has(item.id)) return;
        seenToastAlertIdsRef.current.add(item.id);
        addToast(item.message, "success");
      });
  }, [addToast, alerts]);

  const ensureSystemAlertGoalId = useCallback(async () => {
    const existing = savingGoals.find((goal) => goal.name === SYSTEM_ALERT_GOAL_NAME);
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase
      .from("saving_goals")
      .insert({
        name: SYSTEM_ALERT_GOAL_NAME,
        target_amount: 0,
        current_amount: 0,
        alert_at_amount: 0,
        is_active: false,
      })
      .select()
      .single();

    if (insertError) return null;
    setSavingGoals((prev) => [data, ...prev]);
    return data.id;
  }, [savingGoals]);

  const createAlertIfMissing = useCallback(
    async ({ message, savingGoalId }) => {
      const exists = alerts.some(
        (item) => item.message === message && item.saving_goal_id === savingGoalId
      );
      if (exists) return false;

      const { error: insertError } = await supabase.from("alerts").insert({
        saving_goal_id: savingGoalId,
        message,
      });

      return !insertError;
    },
    [alerts]
  );

  const evaluateSurplusAlerts = useCallback(async () => {
    if (!isConfigured || !user) return;
    if (!transactions.length) return;

    const dailySurplus = calculateSurplus(transactions, "today");
    const weeklySurplus = calculateSurplus(transactions, "week");
    const monthlySurplus = calculateSurplus(transactions, "month");
    let hasCreatedAlert = false;

    for (const goal of savingGoals) {
      if (!goal.is_active || Number(goal.alert_at_amount || 0) <= 0) continue;
      const alertThreshold = Number(goal.alert_at_amount);
      if (monthlySurplus >= alertThreshold) {
        const message = `Saving point reached: AED ${formatAedAmount(
          alertThreshold
        )} surplus achieved.`;
        const created = await createAlertIfMissing({
          message,
          savingGoalId: goal.id,
        });
        if (created) hasCreatedAlert = true;
      }
    }

    const settingsTargets = [
      {
        period: "Daily",
        amount: Number(surplusTargets.dailyTarget || 0),
        current: dailySurplus,
      },
      {
        period: "Weekly",
        amount: Number(surplusTargets.weeklyTarget || 0),
        current: weeklySurplus,
      },
      {
        period: "Monthly",
        amount: Number(surplusTargets.monthlyTarget || 0),
        current: monthlySurplus,
      },
    ].filter((item) => item.amount > 0);

    const customPoints = (surplusTargets.customPoints || [])
      .map((point) => Number(point))
      .filter((point) => point > 0);

    if (settingsTargets.length > 0 || customPoints.length > 0) {
      const systemGoalId = await ensureSystemAlertGoalId();
      if (systemGoalId) {
        for (const target of settingsTargets) {
          if (target.current >= target.amount) {
            const message = `${target.period} target reached: AED ${formatAedAmount(
              target.amount
            )} surplus achieved.`;
            const created = await createAlertIfMissing({
              message,
              savingGoalId: systemGoalId,
            });
            if (created) hasCreatedAlert = true;
          }
        }

        for (const point of customPoints) {
          if (monthlySurplus >= point) {
            const message = `Saving point reached: AED ${formatAedAmount(
              point
            )} surplus achieved.`;
            const created = await createAlertIfMissing({
              message,
              savingGoalId: systemGoalId,
            });
            if (created) hasCreatedAlert = true;
          }
        }
      }
    }

    if (hasCreatedAlert) {
      await loadSavingsData();
    }
  }, [
    createAlertIfMissing,
    ensureSystemAlertGoalId,
    isConfigured,
    loadSavingsData,
    savingGoals,
    surplusTargets.customPoints,
    surplusTargets.dailyTarget,
    surplusTargets.monthlyTarget,
    surplusTargets.weeklyTarget,
    transactions,
    user,
  ]);

  useEffect(() => {
    evaluateSurplusAlerts();
  }, [evaluateSurplusAlerts]);

  const addTransaction = useCallback(
    async (payload) => {
      const person = payload.added_by || payload.person || null;
      const dataToInsert = {
        amount: Number(payload.amount),
        type: payload.type,
        category_id: payload.category_id || payload.category || null,
        added_by: person,
        payment_method: "Cash",
        note: payload.note || "",
        created_at: payload.created_at || new Date().toISOString(),
        transaction_at: payload.transaction_at,
        entered_by: user.id,
        entered_by_name: profile?.full_name || user.email,
      };
      console.log("[addTransaction] insert payload", dataToInsert);

      const legacyInsert = await supabase.from("transactions").insert(dataToInsert);
      if (legacyInsert.error) {
        const modernInsert = await supabase.from("transactions").insert({
          ...dataToInsert,
          created_by: user.id,
        });
        if (modernInsert.error) {
          const isAddedByColumnError =
            String(modernInsert.error.message || "").toLowerCase().includes("added_by") ||
            String(legacyInsert.error.message || "").toLowerCase().includes("added_by");

          if (!isAddedByColumnError) throw modernInsert.error;

          const fallbackNotePrefix = payload.added_by
            ? `[Added By: ${payload.added_by}] `
            : "";
          const fallbackPayload = {
            ...dataToInsert,
            note: `${fallbackNotePrefix}${payload.note || ""}`.trim(),
          };
          delete fallbackPayload.added_by;

          const fallbackInsert = await supabase.from("transactions").insert({
            ...fallbackPayload,
            created_by: user.id,
          });
          if (fallbackInsert.error) throw fallbackInsert.error;
        }
      }
      await loadData();
    },
    [loadData, profile?.full_name, user]
  );

  const addCategory = useCallback(
    async (name, type = "expense") => {
      const legacyInsert = await supabase.from("categories").insert({
        name,
        type,
        user_id: user.id,
      });
      if (legacyInsert.error) {
        const modernInsert = await supabase.from("categories").insert({
          name,
          type,
        });
        if (modernInsert.error) throw modernInsert.error;
      }
      await loadData();
    },
    [loadData, user]
  );

  const createSavingGoal = useCallback(
    async (goalPayload) => {
      const { error: insertError } = await supabase.from("saving_goals").insert(goalPayload);
      if (insertError) throw insertError;
      await loadSavingsData();
    },
    [loadSavingsData]
  );

  const updateSavingGoal = useCallback(
    async (goalId, updates) => {
      const { error: updateError } = await supabase
        .from("saving_goals")
        .update(updates)
        .eq("id", goalId);
      if (updateError) throw updateError;
      await loadSavingsData();
    },
    [loadSavingsData]
  );

  const markAlertRead = useCallback(
    async (alertId) => {
      const { error: updateError } = await supabase
        .from("alerts")
        .update({ is_read: true })
        .eq("id", alertId);
      if (updateError) throw updateError;
      await loadSavingsData();
    },
    [loadSavingsData]
  );

  const saveSurplusTargets = useCallback((nextTargets) => {
    const normalized = {
      dailyTarget: Number(nextTargets.dailyTarget || 0),
      weeklyTarget: Number(nextTargets.weeklyTarget || 0),
      monthlyTarget: Number(nextTargets.monthlyTarget || 0),
      customPoints: (nextTargets.customPoints || [])
        .map((value) => Number(value))
        .filter((value) => value > 0),
    };
    localStorage.setItem(SURPLUS_SETTINGS_KEY, JSON.stringify(normalized));
    setSurplusTargets(normalized);
  }, []);

  const updateProfile = useCallback(
    async (nextProfile) => {
      const payload = {
        id: user.id,
        ...nextProfile,
      };
      const { error: updateError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (updateError) throw updateError;
      await loadData();
    },
    [loadData, user]
  );

  const updateUserRole = useCallback(
    async (profileId, role) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", profileId);
      if (updateError) throw updateError;
      await loadData();
    },
    [loadData]
  );

  const updateUserActive = useCallback(
    async (profileId, isActive) => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", profileId);
      if (updateError) throw updateError;
      await loadData();
    },
    [loadData]
  );

  const inviteStaff = useCallback(
    async ({ email, role }) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const { error: insertError } = await supabase.from("staff_invites").insert({
        email: normalizedEmail,
        role,
        invited_by: user.id,
      });
      if (insertError) throw insertError;
      const otpResult = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
        },
      });
      if (otpResult.error) throw otpResult.error;
      await loadData();
    },
    [loadData, user]
  );

  const sendPasswordReset = useCallback(async (email) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: window.location.origin,
    });
    if (resetError) throw resetError;
  }, []);

  const value = useMemo(
    () => ({
      profile,
      profiles,
      categories,
      transactions,
      dashboardTotals,
      savingGoals,
      alerts,
      staffInvites,
      surplusTargets,
      loading,
      error,
      loadData,
      addTransaction,
      addCategory,
      createSavingGoal,
      updateSavingGoal,
      markAlertRead,
      saveSurplusTargets,
      updateProfile,
      updateUserRole,
      updateUserActive,
      inviteStaff,
      sendPasswordReset,
    }),
    [
      addCategory,
      addTransaction,
      alerts,
      categories,
      createSavingGoal,
      dashboardTotals,
      error,
      inviteStaff,
      loadData,
      loading,
      markAlertRead,
      profile,
      profiles,
      saveSurplusTargets,
      savingGoals,
      sendPasswordReset,
      staffInvites,
      surplusTargets,
      transactions,
      updateProfile,
      updateSavingGoal,
      updateUserActive,
      updateUserRole,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
