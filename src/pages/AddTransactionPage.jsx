import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { EXPENSE_ADDED_BY_OPTIONS } from "../constants";
import { useAppData } from "../context/AppDataContext";
import { SearchableCategorySelect } from "../components/SearchableCategorySelect";
import {
  dubaiDateTimeInputToUtcIso,
  toDubaiDateTimeInputValue,
} from "../lib/date";

function getNowLocalISOString() {
  return toDubaiDateTimeInputValue();
}

export function AddTransactionPage() {
  const { categories, addTransaction } = useAppData();
  const amountInputRef = useRef(null);
  const formRef = useRef(null);
  const successTimerRef = useRef(null);

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    category_id: "",
    added_by: "",
    note: "",
    transaction_at: getNowLocalISOString(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const availableCategories = useMemo(
    () =>
      categories.filter(
        (item) => item.type === form.type || item.type === "both"
      ),
    [categories, form.type]
  );

  const hasValidCategory = useMemo(
    () => availableCategories.some((item) => item.id === form.category_id),
    [availableCategories, form.category_id]
  );

  const hasValidAmount = useMemo(() => Number(form.amount) > 0, [form.amount]);

  const hasValidAddedBy = Boolean(form.added_by);
  const canSave = hasValidAmount && hasValidCategory && hasValidAddedBy && !saving;

  const amountPreview = useMemo(() => {
    const numericValue = Number(form.amount || 0);
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  }, [form.amount]);

  function updateField(key, value) {
    setForm((prev) => {
      if (key === "type" && value === "income") {
        return {
          ...prev,
          type: value,
          category_id: "",
          added_by: "",
        };
      }
      if (key === "type" && value === "expense") {
        return {
          ...prev,
          type: value,
          category_id: "",
        };
      }
      return { ...prev, [key]: value };
    });
  }

  function resetForm() {
    setForm((prev) => ({
      ...prev,
      amount: "",
      note: "",
      category_id: "",
      added_by: "",
      transaction_at: getNowLocalISOString(),
    }));
  }

  const submitTransaction = useCallback(async () => {
    if (!hasValidAmount || !hasValidCategory || !hasValidAddedBy || saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addTransaction({
        amount: Number(form.amount),
        type: form.type,
        category_id: form.category_id,
        person: form.added_by,
        added_by: form.added_by,
        note: form.note,
        created_at: new Date().toISOString(),
        transaction_at: dubaiDateTimeInputToUtcIso(form.transaction_at),
      });
      setShowSuccess(true);
      resetForm();
      amountInputRef.current?.focus();

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false);
      }, 1200);
    } catch (err) {
      setError(err.message || "Failed to add transaction");
    } finally {
      setSaving(false);
    }
  }, [addTransaction, form, hasValidAddedBy, hasValidAmount, hasValidCategory, saving]);

  async function handleSubmit(event) {
    event.preventDefault();
    await submitTransaction();
  }

  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isTypingField =
        activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if (!isTypingField && event.key.toLowerCase() === "i") {
        event.preventDefault();
        updateField("type", "income");
        return;
      }

      if (!isTypingField && event.key.toLowerCase() === "e") {
        event.preventDefault();
        updateField("type", "expense");
        return;
      }

      if (event.key === "Enter" && activeTag !== "textarea") {
        event.preventDefault();
        if (canSave) {
          formRef.current?.requestSubmit();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSave]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  return (
    <Layout title="Add Transaction" subtitle="Quickly record income and expenses">
      <form
        ref={formRef}
        className="card space-y-4 pb-28 text-left"
        onSubmit={handleSubmit}
      >
        <Link
          to="/"
          className="block w-full rounded-2xl bg-slate-900 px-4 py-4 text-center text-lg font-bold text-white"
        >
          ← Dashboard
        </Link>

        <div>
          <label className="field-label">Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={
                form.type === "income"
                  ? "rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white"
                  : "rounded-2xl border border-slate-300 bg-white px-4 py-4 text-lg font-bold text-slate-700"
              }
              onClick={() => updateField("type", "income")}
            >
              Income (I)
            </button>
            <button
              type="button"
              className={
                form.type === "expense"
                  ? "rounded-2xl bg-rose-600 px-4 py-4 text-lg font-bold text-white"
                  : "rounded-2xl border border-slate-300 bg-white px-4 py-4 text-lg font-bold text-slate-700"
              }
              onClick={() => updateField("type", "expense")}
            >
              Expense (E)
            </button>
          </div>
        </div>

        <div>
          <label className="field-label">Added By</label>
          <div className="grid grid-cols-2 gap-3">
            {EXPENSE_ADDED_BY_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => updateField("added_by", name)}
                className={
                  form.added_by === name
                    ? name === "YASSAR"
                      ? "rounded-2xl bg-blue-700 px-4 py-5 text-lg font-bold text-white shadow-md"
                      : "rounded-2xl bg-emerald-700 px-4 py-5 text-lg font-bold text-white shadow-md"
                    : "rounded-2xl border border-slate-300 bg-white px-4 py-5 text-lg font-bold text-slate-700"
                }
                aria-pressed={form.added_by === name}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Amount</label>
          <input
            ref={amountInputRef}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-4xl font-bold text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={form.amount}
            onChange={(event) => updateField("amount", event.target.value)}
          />
          <p className="mt-2 text-sm font-medium text-slate-500">{amountPreview}</p>
        </div>

        <div>
          <label className="field-label">Category</label>
          <SearchableCategorySelect
            categories={categories}
            value={form.category_id}
            onChange={(value) => updateField("category_id", value)}
            allowedType={form.type}
          />
        </div>

        <div>
          <label className="field-label">Date and time</label>
          <input
            className="input"
            type="datetime-local"
            value={form.transaction_at}
            onChange={(event) => updateField("transaction_at", event.target.value)}
          />
        </div>

        <div>
          <label className="field-label">Note</label>
          <textarea
            className="input min-h-[90px]"
            value={form.note}
            onChange={(event) => updateField("note", event.target.value)}
            placeholder="Optional note..."
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {showSuccess ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 animate-bounce items-center justify-center rounded-full bg-emerald-600 text-white">
                ✓
              </span>
              <span className="font-semibold">Saved successfully</span>
            </div>
          </div>
        ) : null}

        <div className="fixed bottom-14 left-0 right-0 z-20 mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:static md:max-w-none md:border-0 md:bg-transparent md:p-0">
          <button className="btn-primary w-full py-3 text-base" type="submit" disabled={!canSave}>
            {saving ? "Saving..." : "Save Transaction (Enter)"}
          </button>
        </div>
      </form>
    </Layout>
  );
}
