import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Layout } from "../components/Layout";
import { CurrencyText } from "../components/CurrencyText";
import { useAppData } from "../context/AppDataContext";
import {
  getDubaiCustomRangeBounds,
  getDubaiNow,
  toDubaiDateInputValue,
  toDubaiDateTime,
} from "../lib/date";
import { formatCurrency, formatDateTime } from "../lib/format";

const APP_NAME = "Daily Money Tracker";

function getDefaultDateRange() {
  const end = getDubaiNow();
  const start = end.minus({ days: 29 });
  return {
    startDate: toDubaiDateInputValue(start),
    endDate: toDubaiDateInputValue(end),
  };
}

function summarize(records) {
  const totalIncome = records
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = records
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  };
}

function downloadBlob(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvField(value) {
  const raw = String(value ?? "");
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function ReportsPage() {
  const { transactions, categories } = useAppData();
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const selectedRangeLabel = `${dateRange.startDate} to ${dateRange.endDate}`;

  const filteredTransactions = useMemo(() => {
    const { start: startDate, end: endDate } = getDubaiCustomRangeBounds(
      dateRange.startDate,
      dateRange.endDate
    );

    return transactions.filter((item) => {
      const transactionDate = toDubaiDateTime(item.transaction_at);
      if (!transactionDate) return false;
      const matchesDate = transactionDate >= startDate && transactionDate <= endDate;
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesCategory =
        categoryFilter === "all" || item.category_id === categoryFilter;
      return matchesDate && matchesType && matchesCategory;
    });
  }, [categoryFilter, dateRange.endDate, dateRange.startDate, transactions, typeFilter]);

  const report = useMemo(() => {
    const totals = summarize(filteredTransactions);

    const byCategoryMap = filteredTransactions.reduce((acc, item) => {
      const name = item.category?.name || "Uncategorized";
      const previous = acc[name] || { income: 0, expenses: 0, total: 0 };
      const amount = Number(item.amount || 0);
      if (item.type === "income") {
        previous.income += amount;
      } else {
        previous.expenses += amount;
      }
      previous.total = previous.income - previous.expenses;
      acc[name] = previous;
      return acc;
    }, {});

    const dailyMap = filteredTransactions.reduce((acc, item) => {
      const date = toDubaiDateTime(item.transaction_at)?.toFormat("yyyy-LL-dd");
      if (!date) return acc;
      const previous = acc[date] || { income: 0, expenses: 0, net: 0 };
      const amount = Number(item.amount || 0);
      if (item.type === "income") {
        previous.income += amount;
      } else {
        previous.expenses += amount;
      }
      previous.net = previous.income - previous.expenses;
      acc[date] = previous;
      return acc;
    }, {});

    return {
      ...totals,
      byCategory: Object.entries(byCategoryMap)
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
      dailyBreakdown: Object.entries(dailyMap)
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [filteredTransactions]);

  const incomeExpenseChartData = report.dailyBreakdown;
  const incomeExpenseChartMax = useMemo(() => {
    const values = incomeExpenseChartData.flatMap((item) => [item.income, item.expenses]);
    return Math.max(...values, 1);
  }, [incomeExpenseChartData]);

  const expenseByCategoryChartData = useMemo(
    () =>
      report.byCategory
        .filter((item) => item.expenses > 0)
        .sort((a, b) => b.expenses - a.expenses)
        .slice(0, 8),
    [report.byCategory]
  );

  const expenseCategoryMax = useMemo(() => {
    const values = expenseByCategoryChartData.map((item) => item.expenses);
    return Math.max(...values, 1);
  }, [expenseByCategoryChartData]);

  function handleExportCsv() {
    const summaryLines = [
      ["App Name", APP_NAME],
      ["Selected Date Range", selectedRangeLabel],
      ["Total Income", report.totalIncome.toFixed(2)],
      ["Total Expenses", report.totalExpenses.toFixed(2)],
      ["Net Surplus/Deficit", report.net.toFixed(2)],
      ["Generated At", new Date().toLocaleString()],
      [],
    ];

    const transactionHeaders = [
      "Date/Time",
      "Type",
      "Category",
      "Amount",
      "Note",
      "Created By",
    ];

    const transactionRows = filteredTransactions.map((item) => [
      formatDateTime(item.transaction_at),
      item.type,
      item.category?.name || "Uncategorized",
      Number(item.amount || 0).toFixed(2),
      item.note || "",
      item.entered_by_name || "-",
    ]);

    const lines = [...summaryLines, transactionHeaders, ...transactionRows]
      .map((row) => row.map((value) => toCsvField(value)).join(","))
      .join("\n");

    downloadBlob(
      `daily-money-tracker-report-${Date.now()}.csv`,
      lines,
      "text/csv;charset=utf-8;"
    );
  }

  function handleExportPdf() {
    const doc = new jsPDF();
    const generatedAt = formatDateTime(getDubaiNow().toUTC().toISO());

    doc.setFontSize(16);
    doc.text(APP_NAME, 14, 16);
    doc.setFontSize(10);
    doc.text(`Selected Date Range: ${selectedRangeLabel}`, 14, 24);
    doc.text(`Total Income: ${formatCurrency(report.totalIncome)}`, 14, 30);
    doc.text(`Total Expense: ${formatCurrency(report.totalExpenses)}`, 14, 36);
    doc.text(`Surplus/Deficit: ${formatCurrency(report.net)}`, 14, 42);
    doc.text(`Generated: ${generatedAt}`, 14, 48);

    autoTable(doc, {
      startY: 54,
      head: [["Category", "Income", "Expenses", "Net"]],
      body: report.byCategory.map((row) => [
        row.name,
        formatCurrency(row.income),
        formatCurrency(row.expenses),
        formatCurrency(row.total),
      ]),
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Date/Time", "Type", "Category", "Amount", "Note"]],
      body: filteredTransactions.map((item) => [
        formatDateTime(item.transaction_at),
        item.type,
        item.category?.name || "Uncategorized",
        formatCurrency(item.amount),
        item.note || "",
      ]),
      theme: "grid",
      styles: { fontSize: 8, cellWidth: "wrap" },
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`daily-money-tracker-report-${Date.now()}.pdf`);
  }

  return (
    <Layout title="Reports" subtitle="Filtered insights and exports">
      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">From</label>
            <input
              type="date"
              className="input"
              value={dateRange.startDate}
              onChange={(event) =>
                setDateRange((prev) => ({ ...prev, startDate: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="field-label">To</label>
            <input
              type="date"
              className="input"
              value={dateRange.endDate}
              onChange={(event) =>
                setDateRange((prev) => ({ ...prev, endDate: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-2 space-y-2">
          <div>
            <label className="field-label">Category</label>
            <select
              className="input"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Type</label>
            <select
              className="input"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">Income + Expense</option>
              <option value="income">Income only</option>
              <option value="expense">Expense only</option>
            </select>
          </div>

        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn-secondary" type="button" onClick={handleExportPdf}>
            Export PDF
          </button>
          <button className="btn-primary" type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <article className="card">
          <p className="card-title">Total Income</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            <CurrencyText value={report.totalIncome} codeClassName="text-emerald-700" />
          </p>
        </article>
        <article className="card">
          <p className="card-title">Total Expenses</p>
          <p className="mt-2 text-3xl font-bold text-rose-600">
            <CurrencyText value={report.totalExpenses} codeClassName="text-rose-700" />
          </p>
        </article>
        <article className="card">
          <p className="card-title">Net Surplus / Deficit</p>
          <p
            className={`mt-2 text-3xl font-bold ${
              report.net >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            <CurrencyText
              value={report.net}
              showPlus={report.net > 0}
              codeClassName={report.net >= 0 ? "text-emerald-700" : "text-rose-700"}
            />
          </p>
        </article>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Category breakdown</h2>
        <ul className="mt-3 space-y-2">
          {report.byCategory.map((item) => (
            <li
              key={item.name}
              className="grid grid-cols-4 items-center gap-2 rounded-xl bg-slate-100 p-2 text-sm"
            >
              <p className="font-medium text-slate-700">{item.name}</p>
              <p className="text-emerald-600">
                <CurrencyText value={item.income} codeClassName="text-emerald-700" />
              </p>
              <p className="text-rose-600">
                <CurrencyText value={item.expenses} codeClassName="text-rose-700" />
              </p>
              <p className={item.total >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                <CurrencyText
                  value={item.total}
                  showPlus={item.total > 0}
                  codeClassName={item.total >= 0 ? "text-emerald-700" : "text-rose-700"}
                />
              </p>
            </li>
          ))}
          {report.byCategory.length === 0 ? (
            <li className="rounded-xl bg-slate-100 p-2 text-sm text-slate-500">No data</li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Daily breakdown</h2>
        <ul className="mt-3 space-y-2">
          {report.dailyBreakdown.map((item) => (
            <li
              key={item.date}
              className="grid grid-cols-4 items-center gap-2 rounded-xl border border-slate-200 p-2 text-sm"
            >
              <p className="font-medium text-slate-700">{item.date}</p>
              <p className="text-emerald-600">
                <CurrencyText value={item.income} codeClassName="text-emerald-700" />
              </p>
              <p className="text-rose-600">
                <CurrencyText value={item.expenses} codeClassName="text-rose-700" />
              </p>
              <p className={item.net >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                <CurrencyText
                  value={item.net}
                  showPlus={item.net > 0}
                  codeClassName={item.net >= 0 ? "text-emerald-700" : "text-rose-700"}
                />
              </p>
            </li>
          ))}
          {report.dailyBreakdown.length === 0 ? (
            <li className="rounded-xl bg-slate-100 p-2 text-sm text-slate-500">No data</li>
          ) : null}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Chart: Income vs Expense by day</h2>
        <div className="mt-3 space-y-2">
          {incomeExpenseChartData.map((item) => (
            <div key={item.date} className="space-y-1 rounded-xl bg-slate-100 p-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{item.date}</span>
                <span className={item.net >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                  <CurrencyText
                    value={item.net}
                    showPlus={item.net > 0}
                    codeClassName={item.net >= 0 ? "text-emerald-700" : "text-rose-700"}
                  />
                </span>
              </div>
              <div className="h-2 w-full rounded bg-slate-200">
                <div
                  className="h-2 rounded bg-emerald-500"
                  style={{ width: `${Math.max((item.income / incomeExpenseChartMax) * 100, 2)}%` }}
                />
              </div>
              <div className="h-2 w-full rounded bg-slate-200">
                <div
                  className="h-2 rounded bg-rose-500"
                  style={{ width: `${Math.max((item.expenses / incomeExpenseChartMax) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Chart: Expenses by category</h2>
        <div className="mt-3 space-y-2">
          {expenseByCategoryChartData.map((item) => (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{item.name}</span>
                <span className="text-rose-700">
                  <CurrencyText value={item.expenses} codeClassName="text-rose-700" />
                </span>
              </div>
              <div className="h-2 w-full rounded bg-slate-200">
                <div
                  className="h-2 rounded bg-rose-500"
                  style={{ width: `${Math.max((item.expenses / expenseCategoryMax) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))}
          {expenseByCategoryChartData.length === 0 ? (
            <p className="text-sm text-slate-500">No expense category data.</p>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Transaction table</h2>
        <ul className="mt-3 space-y-2">
          {filteredTransactions.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-800">
                  {item.category?.name || "Uncategorized"}
                </p>
                <p className={item.type === "income" ? "text-emerald-600" : "text-rose-600"}>
                  <CurrencyText
                    value={item.amount}
                    codeClassName={item.type === "income" ? "text-emerald-700" : "text-rose-700"}
                  />
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {formatDateTime(item.transaction_at)} | {item.type}
              </p>
              {item.note ? <p className="mt-1 text-xs text-slate-600">{item.note}</p> : null}
            </li>
          ))}
          {filteredTransactions.length === 0 ? (
            <li className="rounded-xl bg-slate-100 p-2 text-sm text-slate-500">No transactions found.</li>
          ) : null}
        </ul>
      </section>
    </Layout>
  );
}
