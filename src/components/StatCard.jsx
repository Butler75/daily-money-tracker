import { formatCurrency } from "../lib/format";

export function StatCard({ label, value, tone = "neutral", signed = false }) {
  const toneClasses = {
    positive: "text-emerald-600",
    negative: "text-rose-600",
    neutral: "text-slate-900",
  };
  const numericValue = Number(value || 0);
  const displayValue =
    signed && numericValue > 0
      ? `+${formatCurrency(numericValue)}`
      : formatCurrency(numericValue);

  return (
    <article className="card p-3 md:p-5">
      <p className="card-title">{label}</p>
      <p className={`mt-2 text-xl font-extrabold md:text-3xl ${toneClasses[tone]}`}>{displayValue}</p>
    </article>
  );
}
