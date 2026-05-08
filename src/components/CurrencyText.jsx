import { formatCurrency } from "../lib/format";

function getAmountText(value) {
  return formatCurrency(Math.abs(Number(value || 0))).replace(/^AED[\s\u00A0]*/u, "");
}

export function CurrencyText({
  value,
  className = "",
  codeClassName = "",
}) {
  const numeric = Number(value || 0);
  const sign = numeric < 0 ? "-" : "";

  return (
    <span className={className}>
      {sign}
      <span className={`align-baseline text-[0.75em] font-semibold ${codeClassName}`}>AED</span>{" "}
      <span>{getAmountText(numeric)}</span>
    </span>
  );
}
