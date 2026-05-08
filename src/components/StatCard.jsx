import { formatCurrency } from "../lib/format";

export function StatCard({ label, value, tone = "neutral" }) {
  const toneClasses = {
    positive: "text-emerald-600",
    negative: "text-rose-600",
    neutral: "text-slate-900",
  };

  return (
    <article className="card">
      <p className="card-title">{label}</p>
      <p className={`money-display mt-2 ${toneClasses[tone]}`}>
        {formatCurrency(value)}
      </p>
    </article>
  );
}
