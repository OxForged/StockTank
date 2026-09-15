/** Formatting helpers shared across modules. */

export function formatMad(value: number): string {
  if (value >= 1_000_000) {
    const millions = (value / 1_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `${millions}M MAD`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K MAD`;
  }
  return `${value} MAD`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
