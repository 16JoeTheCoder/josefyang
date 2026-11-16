const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-04" → "4 Nov 2026" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return `${d ? `${d} ` : ""}${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}
/** "2026-11" → "November 2026" */
export function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : ym;
}
export function monthNumber(ym: string): string {
  return String(Number(ym.split("-")[1] ?? "0"));
}
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
