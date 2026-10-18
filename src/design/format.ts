/**
 * Display formatting for the design layer. Data values arrive in whatever case
 * the taxonomy stores them ("beans", "Indian"), so everything shown to people
 * goes through here to look consistent.
 */

/** Upper-case the first letter and leave the rest: "beans" → "Beans". */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Minutes as "35 min", "2 h" or "2 h 30". */
export function duration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest}` : `${minutes / 60} h`;
}
