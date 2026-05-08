import { CurrencyText } from "./CurrencyText";

export function StatCard({
  label,
  value,
  tone = "neutral",
  signed = false,
  valueClassName = "",
}) {
  const toneClasses = {
    positive: "text-emerald-600",
    negative: "text-rose-600",
    neutral: "text-slate-900",
  };
  const numericValue = Number(value || 0);

  return (
    <article className="card p-3 md:p-5">
      <p className="card-title">{label}</p>
      <CurrencyText
        value={numericValue}
        showPlus={signed}
        className={`mt-2 inline-block text-xl font-extrabold md:text-3xl ${toneClasses[tone]} ${valueClassName}`}
      />
    </article>
  );
}
