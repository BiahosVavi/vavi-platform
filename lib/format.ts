/** '15,000 MAD' — single currency everywhere by design. */
export function formatMAD(amount: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} MAD`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

/** Signed delta label: '+3', '-12%', '±0'. */
export function formatDelta(value: number, suffix = ""): string {
  if (value === 0) return `±0${suffix}`;
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}
