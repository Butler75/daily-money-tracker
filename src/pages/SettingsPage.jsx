import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const SETTINGS_KEY = "daily-money-tracker-settings";

export function SettingsPage() {
  const { profile, updateProfile, surplusTargets, saveSurplusTargets } = useAppData();
  const { user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [currency, setCurrency] = useState("USD");
  const [dailyTarget, setDailyTarget] = useState(String(surplusTargets.dailyTarget || ""));
  const [weeklyTarget, setWeeklyTarget] = useState(String(surplusTargets.weeklyTarget || ""));
  const [monthlyTarget, setMonthlyTarget] = useState(String(surplusTargets.monthlyTarget || ""));
  const [customPointsInput, setCustomPointsInput] = useState(
    (surplusTargets.customPoints || []).join(", ")
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || "");
  }, [profile?.full_name]);

  useEffect(() => {
    setDailyTarget(String(surplusTargets.dailyTarget || ""));
    setWeeklyTarget(String(surplusTargets.weeklyTarget || ""));
    setMonthlyTarget(String(surplusTargets.monthlyTarget || ""));
    setCustomPointsInput((surplusTargets.customPoints || []).join(", "));
  }, [
    surplusTargets.customPoints,
    surplusTargets.dailyTarget,
    surplusTargets.monthlyTarget,
    surplusTargets.weeklyTarget,
  ]);

  useEffect(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setCurrency(parsed.currency || "USD");
    } catch {
      setCurrency("USD");
    }
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateProfile({ full_name: fullName });
      const customPoints = customPointsInput
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => item > 0);

      saveSurplusTargets({
        dailyTarget: Number(dailyTarget || 0),
        weeklyTarget: Number(weeklyTarget || 0),
        monthlyTarget: Number(monthlyTarget || 0),
        customPoints,
      });
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          currency,
        })
      );
      setMessage("Settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <Layout title="Settings" subtitle="Profile and app preferences">
      <form className="card space-y-3" onSubmit={handleSave}>
        <div>
          <label className="field-label">Full name</label>
          <input
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Currency display</label>
          <select
            className="input"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="AED">AED</option>
            <option value="SAR">SAR</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">Signed in as {user?.email}</p>
        {profile?.role === "owner" ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Owner surplus targets</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="field-label">Daily target</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dailyTarget}
                  onChange={(event) => setDailyTarget(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Weekly target</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={weeklyTarget}
                  onChange={(event) => setWeeklyTarget(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Monthly target</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyTarget}
                  onChange={(event) => setMonthlyTarget(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="field-label">Custom saving alert points (comma separated)</label>
              <input
                className="input"
                placeholder="5000, 10000, 15000"
                value={customPointsInput}
                onChange={(event) => setCustomPointsInput(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </button>
      </form>

      <button className="btn-secondary w-full" type="button" onClick={handleLogout}>
        Logout
      </button>
    </Layout>
  );
}
