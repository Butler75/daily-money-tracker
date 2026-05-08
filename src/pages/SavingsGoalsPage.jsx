import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useAppData } from "../context/AppDataContext";
import { formatCurrency, formatDateTime } from "../lib/format";

const initialForm = {
  name: "",
  target_amount: "",
  alert_at_amount: "",
  current_amount: "",
  is_active: true,
};

export function SavingsGoalsPage() {
  const {
    savingGoals,
    alerts,
    createSavingGoal,
    updateSavingGoal,
    markAlertRead,
  } = useAppData();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftAmounts, setDraftAmounts] = useState({});

  const visibleGoals = useMemo(
    () => savingGoals.filter((goal) => goal.name !== "System Surplus Alerts"),
    [savingGoals]
  );
  const unreadAlerts = useMemo(
    () => alerts.filter((item) => !item.is_read),
    [alerts]
  );

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateGoal(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await createSavingGoal({
        name: form.name.trim(),
        target_amount: Number(form.target_amount || 0),
        alert_at_amount: Number(form.alert_at_amount || 0),
        current_amount: Number(form.current_amount || 0),
        is_active: form.is_active,
      });
      setForm(initialForm);
      setMessage("Saving goal created.");
    } catch (err) {
      setError(err.message || "Failed to create saving goal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleGoal(goal) {
    await updateSavingGoal(goal.id, { is_active: !goal.is_active });
  }

  async function handleUpdateCurrentAmount(goal) {
    const value = draftAmounts[goal.id];
    if (value === undefined) return;
    await updateSavingGoal(goal.id, { current_amount: Number(value || 0) });
  }

  return (
    <Layout title="Savings Goals" subtitle="Track goals and surplus alerts">
      <section className="card">
        <h2 className="text-lg font-semibold">Create saving goal</h2>
        <form className="mt-3 space-y-3" onSubmit={handleCreateGoal}>
          <div>
            <label className="field-label">Goal name</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => updateFormField("name", event.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Target amount</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.target_amount}
                onChange={(event) => updateFormField("target_amount", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Alert amount</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.alert_at_amount}
                onChange={(event) => updateFormField("alert_at_amount", event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Current saved amount</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.current_amount}
                onChange={(event) => updateFormField("current_amount", event.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select
                className="input"
                value={form.is_active ? "active" : "inactive"}
                onChange={(event) =>
                  updateFormField("is_active", event.target.value === "active")
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
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
            {saving ? "Creating..." : "Create Goal"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Goals list</h2>
        <ul className="mt-3 space-y-2">
          {visibleGoals.map((goal) => (
            <li key={goal.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{goal.name}</p>
                  <p className="text-xs text-slate-500">
                    Target {formatCurrency(goal.target_amount)} | Alert at{" "}
                    {formatCurrency(goal.alert_at_amount)}
                  </p>
                </div>
                <button
                  className={goal.is_active ? "btn-secondary" : "btn-primary"}
                  type="button"
                  onClick={() => handleToggleGoal(goal)}
                >
                  {goal.is_active ? "Set Inactive" : "Set Active"}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftAmounts[goal.id] ?? goal.current_amount ?? 0}
                  onChange={(event) =>
                    setDraftAmounts((prev) => ({
                      ...prev,
                      [goal.id]: event.target.value,
                    }))
                  }
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => handleUpdateCurrentAmount(goal)}
                >
                  Update
                </button>
              </div>
            </li>
          ))}
          {visibleGoals.length === 0 ? (
            <li className="rounded-xl bg-slate-100 p-2 text-sm text-slate-500">
              No saving goals yet.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Alerts list</h2>
        <ul className="mt-3 space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`rounded-xl border p-3 ${
                alert.is_read
                  ? "border-slate-200 bg-white"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <p className="text-sm font-medium text-slate-800">{alert.message}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-slate-500">{formatDateTime(alert.created_at)}</p>
                {!alert.is_read ? (
                  <button
                    className="btn-secondary px-2 py-1 text-xs"
                    type="button"
                    onClick={() => markAlertRead(alert.id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {alerts.length === 0 ? (
            <li className="rounded-xl bg-slate-100 p-2 text-sm text-slate-500">
              No alerts yet.
            </li>
          ) : null}
        </ul>
        {unreadAlerts.length > 0 ? (
          <p className="mt-3 text-xs font-medium text-amber-700">
            {unreadAlerts.length} unread alert(s)
          </p>
        ) : null}
      </section>
    </Layout>
  );
}
