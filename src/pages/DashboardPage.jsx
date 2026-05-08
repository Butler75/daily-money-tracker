import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { StatCard } from "../components/StatCard";
import { formatCurrency } from "../lib/format";
import {
  DUBAI_TIMEZONE,
  getDubaiNow,
  toDubaiDateTime,
} from "../lib/date";
import { DateTime } from "luxon";
import { supabase } from "../lib/supabase";

function summarize(records) {
  const income = records
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = records
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { income, expenses, balance: income - expenses, count: records.length };
}

function getEmojiForBalance(balance) {
  if (balance > 0) return "🙂";
  if (balance < 0) return "☹️";
  return "😐";
}

function getCalendarCells(activeMonth) {
  const startOfMonth = activeMonth.startOf("month");
  const daysInMonth = activeMonth.daysInMonth;
  const leadingEmpty = startOfMonth.weekday % 7; // Sunday=0

  const cells = [];
  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push({ key: `empty-${i}`, isEmpty: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = activeMonth.set({ day });
    cells.push({
      key: date.toFormat("yyyy-LL-dd"),
      isEmpty: false,
      date,
    });
  }
  return cells;
}

function formatTimeOnly(dateIso) {
  const dt = toDubaiDateTime(dateIso);
  if (!dt) return "-";
  return dt.toFormat("hh:mm a");
}

function getPersonLabel(item) {
  return (item.added_by || item.entered_by_name || "-").toUpperCase();
}

function getPersonBadgeClass(item) {
  const person = getPersonLabel(item);
  if (person.includes("YASSAR")) {
    return "bg-blue-50 text-blue-700 ring-blue-200";
  }
  if (person.includes("ALEX")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function normalizeNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  return raw.replace(/^\[Added By:\s*(YASSAR|ALEX)\]\s*/i, "").trim();
}

export function DashboardPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const now = getDubaiNow();
  const activeMonth = now.startOf("month");
  const todayKey = now.toFormat("yyyy-LL-dd");
  const monthKey = now.toFormat("yyyy-LL");

  const fetchDashboardTransactions = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("transactions")
      .select(`
        id,
        type,
        amount,
        payment_method,
        note,
        transaction_at,
        entered_by_name,
        categories (
          name
        )
      `)
      .order("transaction_at", { ascending: false });

    if (queryError) {
      setTransactions([]);
      setError(queryError.message || "Failed to load dashboard transactions");
      setLoading(false);
      return;
    }

    setTransactions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardTransactions();
  }, [fetchDashboardTransactions]);

  const todayStats = useMemo(() => {
    const todayTransactions = transactions.filter((item) => {
      const date = toDubaiDateTime(item.transaction_at);
      return date?.toFormat("yyyy-LL-dd") === todayKey;
    });
    return summarize(todayTransactions);
  }, [todayKey, transactions]);

  const monthStats = useMemo(() => {
    const monthRows = transactions.filter((item) => {
      const date = toDubaiDateTime(item.transaction_at);
      return date?.toFormat("yyyy-LL") === monthKey;
    });
    return summarize(monthRows);
  }, [monthKey, transactions]);

  const monthTransactions = useMemo(
    () =>
      transactions.filter((item) => {
        const date = toDubaiDateTime(item.transaction_at);
        return date && date.hasSame(activeMonth, "month");
      }),
    [activeMonth, transactions]
  );

  useEffect(() => {
    if (selectedDateKey || monthTransactions.length === 0) return;
    const firstDate = toDubaiDateTime(monthTransactions[0].transaction_at);
    if (firstDate) {
      setSelectedDateKey(firstDate.toFormat("yyyy-LL-dd"));
    }
  }, [monthTransactions, selectedDateKey]);

  const byDay = useMemo(() => {
    const map = new Map();
    monthTransactions.forEach((item) => {
      const date = toDubaiDateTime(item.transaction_at);
      if (!date) return;
      const key = date.toFormat("yyyy-LL-dd");
      const current = map.get(key) || { income: 0, expenses: 0, balance: 0, count: 0 };
      const amount = Number(item.amount || 0);
      if (item.type === "income") current.income += amount;
      else current.expenses += amount;
      current.balance = current.income - current.expenses;
      current.count += 1;
      map.set(key, current);
    });
    return map;
  }, [monthTransactions]);

  const calendarCells = useMemo(() => getCalendarCells(activeMonth), [activeMonth]);

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDateKey) return [];
    const selectedDubaiDate = DateTime.fromISO(selectedDateKey, { zone: DUBAI_TIMEZONE });
    if (!selectedDubaiDate.isValid) return [];

    return monthTransactions.filter((item) => {
      const date = toDubaiDateTime(item.transaction_at);
      return date && date.hasSame(selectedDubaiDate, "day");
    });
  }, [monthTransactions, selectedDateKey]);

  const selectedDaySummary = useMemo(() => {
    if (!selectedDateKey) return null;
    return byDay.get(selectedDateKey) || { income: 0, expenses: 0, balance: 0, count: 0 };
  }, [byDay, selectedDateKey]);

  const selectedDayExpenses = useMemo(
    () => selectedDayTransactions.filter((item) => item.type === "expense"),
    [selectedDayTransactions]
  );
  const selectedDayIncome = useMemo(
    () => selectedDayTransactions.filter((item) => item.type === "income"),
    [selectedDayTransactions]
  );
  const latestSelectedDayTransaction = selectedDayTransactions[0] || null;

  return (
    <Layout title="Dashboard" subtitle="Monthly business performance calendar">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <p className="text-sm font-semibold text-slate-600">
        Loaded transactions: {transactions.length}
      </p>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Today Surplus / Deficit"
          value={todayStats.balance}
          tone={todayStats.balance >= 0 ? "positive" : "negative"}
          signed
          valueClassName="text-lg md:text-3xl"
        />
        <StatCard
          label="Month-to-date Surplus / Deficit"
          value={monthStats.balance}
          tone={monthStats.balance >= 0 ? "positive" : "negative"}
          signed
          valueClassName="text-lg md:text-3xl"
        />
        <StatCard
          label="Month-to-date Income"
          value={monthStats.income}
          tone="positive"
          valueClassName="text-lg md:text-3xl"
        />
        <StatCard
          label="Month-to-date Expense"
          value={monthStats.expenses}
          tone="negative"
          valueClassName="text-lg md:text-3xl"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        <Link
          to="/"
          className="rounded-2xl bg-slate-900 px-4 py-4 text-center text-base font-semibold text-white shadow-sm"
        >
          Dashboard
        </Link>
        <Link
          to="/add-transaction"
          className="rounded-2xl bg-emerald-600 px-4 py-4 text-center text-base font-semibold text-white shadow-sm"
        >
          Add
        </Link>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {activeMonth.toFormat("LLLL yyyy")}
          </h2>
          <p className="text-xs text-slate-500">Tap a day to view transactions</p>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:gap-2 md:text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-0.5 md:gap-1.5">
          {calendarCells.map((cell) => {
            if (cell.isEmpty) {
              return (
                <div
                  key={cell.key}
                  className="min-h-[70px] rounded-lg border border-transparent bg-transparent md:min-h-[98px]"
                />
              );
            }

            const dateKey = cell.date.toFormat("yyyy-LL-dd");
            const summary = byDay.get(dateKey) || {
              income: 0,
              expenses: 0,
              balance: 0,
              count: 0,
            };
            const isSelected = selectedDateKey === dateKey;

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                className={`group relative min-h-[70px] rounded-lg border bg-white p-1 text-left transition md:min-h-[98px] md:p-1.5 ${
                  isSelected
                    ? "border-slate-900 ring-1 ring-slate-900"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <p className="text-xs font-semibold text-slate-800">{cell.date.day}</p>
                <p className="mt-1 text-[10px] font-medium text-emerald-600 md:text-xs">
                  +{formatCurrency(summary.income)}
                </p>
                <p className="text-[10px] font-medium text-rose-600 md:text-xs">
                  -{formatCurrency(summary.expenses)}
                </p>
                <p
                  className={`text-[10px] font-semibold md:text-xs ${
                    summary.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {formatCurrency(summary.balance)}
                </p>
                <p className="mt-1 text-sm">{getEmojiForBalance(summary.balance)}</p>

                <div className="pointer-events-none absolute left-1/2 top-full z-20 hidden w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-lg group-hover:block">
                  <p className="text-xs font-semibold text-slate-800">
                    {DateTime.fromISO(dateKey).toFormat("dd LLL yyyy")}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-600">
                    Income: {formatCurrency(summary.income)}
                  </p>
                  <p className="text-[11px] text-rose-600">
                    Expense: {formatCurrency(summary.expenses)}
                  </p>
                  <p
                    className={`text-[11px] font-semibold ${
                      summary.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    Net: {formatCurrency(summary.balance)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Transactions: {summary.count}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900">
          {selectedDateKey
            ? `Transactions - ${DateTime.fromISO(selectedDateKey).toFormat("dd LLL yyyy")}`
            : "Select a day to view transactions"}
        </h2>

        {loading ? <p className="mt-3 text-sm text-slate-500">Loading transactions...</p> : null}

        {!loading && selectedDateKey && selectedDayTransactions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No transactions for selected day.</p>
        ) : null}

        {!loading && !selectedDateKey ? (
          <p className="mt-3 text-sm text-slate-500">
            Tap any day in the calendar to view transaction details.
          </p>
        ) : null}

        {selectedDateKey && selectedDaySummary ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <article className="rounded-xl bg-slate-100 p-2">
              <p className="text-[11px] uppercase text-slate-500">Income</p>
              <p className="font-semibold text-emerald-700">
                {formatCurrency(selectedDaySummary.income)}
              </p>
            </article>
            <article className="rounded-xl bg-slate-100 p-2">
              <p className="text-[11px] uppercase text-slate-500">Expense</p>
              <p className="font-semibold text-rose-700">
                {formatCurrency(selectedDaySummary.expenses)}
              </p>
            </article>
            <article className="rounded-xl bg-slate-100 p-2">
              <p className="text-[11px] uppercase text-slate-500">Net</p>
              <p
                className={`font-semibold ${
                  selectedDaySummary.balance >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatCurrency(selectedDaySummary.balance)}
              </p>
            </article>
          </div>
        ) : null}

        {selectedDateKey ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
              <h3 className="text-sm font-semibold text-slate-800">Latest saved transaction</h3>
              {latestSelectedDayTransaction ? (
                <div className="mt-1 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">
                    {latestSelectedDayTransaction.categories?.name || "Uncategorized"} - {formatCurrency(latestSelectedDayTransaction.amount)}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">
                      {formatTimeOnly(latestSelectedDayTransaction.transaction_at)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getPersonBadgeClass(
                        latestSelectedDayTransaction
                      )}`}
                    >
                      {getPersonLabel(latestSelectedDayTransaction)}
                    </span>
                  </div>
                  {normalizeNote(latestSelectedDayTransaction.note) ? (
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {normalizeNote(latestSelectedDayTransaction.note)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No saved transactions for this selected day.
                </p>
              )}
            </article>

            <article className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
              <h3 className="text-xs font-semibold text-rose-700 md:text-sm">
                Expenses ({selectedDayExpenses.length})
              </h3>
              {selectedDayExpenses.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500 md:text-sm">No expenses for this day.</p>
              ) : (
                <ol className="mt-2 space-y-1.5">
                  {selectedDayExpenses.map((item, index) => (
                    <li key={item.id} className="rounded-lg border border-rose-100 bg-white p-2 text-xs">
                      <p className="font-semibold text-slate-800">
                        {index + 1}. {item.categories?.name || "Uncategorized"} -{" "}
                        <span className="text-rose-700">{formatCurrency(item.amount)}</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-500">
                          {formatTimeOnly(item.transaction_at)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getPersonBadgeClass(item)}`}
                        >
                          {getPersonLabel(item)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </article>

            <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <h3 className="text-xs font-semibold text-emerald-700 md:text-sm">
                Income ({selectedDayIncome.length})
              </h3>
              {selectedDayIncome.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500 md:text-sm">No income for this day.</p>
              ) : (
                <ol className="mt-2 space-y-1.5">
                  {selectedDayIncome.map((item, index) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-emerald-100 bg-white p-2 text-xs"
                    >
                      <p className="font-semibold text-slate-800">
                        {index + 1}. {item.categories?.name || "Uncategorized"} -{" "}
                        <span className="text-emerald-700">{formatCurrency(item.amount)}</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-500">
                          {formatTimeOnly(item.transaction_at)}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getPersonBadgeClass(item)}`}
                        >
                          {getPersonLabel(item)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          </div>
        ) : null}
      </section>
    </Layout>
  );
}
