const DAY = 86400000;
export const REMINDER_HISTORY_DAYS = 56;
export const REMINDER_MIN_WEEKS = 3;
export const REMINDER_DAILY_LIMIT = 3;

export type ReminderMovement = { dataHora: Date; categoria: { id: string; nome: string } | null };
export type ReminderCandidate = { profileId: string; categoriaId: string; categoriaNome: string; referenceDate: string;
  recurringWeeks: number; mostRecent: Date; hour: number | null; eventKey: string };
export function reminderDay(date: Date) { return new Date(date.toISOString().slice(0, 10) + 'T00:00:00Z'); }
function week(date: Date) {
  const start = reminderDay(date); start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); return start.toISOString();
}

// RN-NOT-03: um conjunto de semanas, nunca quantidade de linhas, caracteriza recorrência.
export function detectTransactionReminders(profileId: string, rows: ReminderMovement[], referenceDay: Date, now: Date): ReminderCandidate[] {
  const day = reminderDay(referenceDay); const historyStart = new Date(day.getTime() - REMINDER_HISTORY_DAYS * DAY);
  const groups = new Map<string, { name: string; rows: ReminderMovement[] }>();
  for (const row of rows) {
    if (!row.categoria || row.dataHora < historyStart || row.dataHora >= day || row.dataHora.getUTCDay() !== day.getUTCDay()) continue;
    const group = groups.get(row.categoria.id);
    if (group) group.rows.push(row); else groups.set(row.categoria.id, { name: row.categoria.nome, rows: [row] });
  }
  const candidates: ReminderCandidate[] = [];
  const stats = (items: ReminderMovement[]) => ({ weeks: new Set(items.map(row => week(row.dataHora))).size,
    recent: new Date(items.reduce((recent, row) => Math.max(recent, row.dataHora.getTime()), -Infinity)) });
  for (const [category, group] of groups) {
    const all = stats(group.rows); if (all.weeks < REMINDER_MIN_WEEKS) continue;
    const hours = new Map<number, ReminderMovement[]>();
    for (const row of group.rows) { const h = row.dataHora.getUTCHours(); const items = hours.get(h); if (items) items.push(row); else hours.set(h, [row]); }
    const timed = [...hours].map(([hour, items]) => ({ hour, ...stats(items) })).filter(s => s.weeks >= REMINDER_MIN_WEEKS)
      .sort((a, b) => b.weeks - a.weeks || b.recent.getTime() - a.recent.getTime() || a.hour - b.hour)[0];
    const start = new Date(day.getTime() + (timed ? timed.hour * 3600000 : 0));
    const end = new Date(start.getTime() + (timed ? 3600000 : DAY));
    if (end > now) continue;
    if (rows.some(row => row.categoria?.id === category && row.dataHora >= start && row.dataHora < end && row.dataHora <= now)) continue;
    const referenceDate = day.toISOString().slice(0, 10);
    candidates.push({ profileId, categoriaId: category, categoriaNome: group.name, referenceDate,
      recurringWeeks: all.weeks, mostRecent: all.recent, hour: timed?.hour ?? null,
      eventKey: JSON.stringify([profileId, category, referenceDate]) });
  }
  return candidates;
}

export function rankTransactionReminders(candidates: ReminderCandidate[]) {
  return [...candidates].sort((a, b) => b.recurringWeeks - a.recurringWeeks || b.mostRecent.getTime() - a.mostRecent.getTime()
    || a.profileId.localeCompare(b.profileId) || a.categoriaId.localeCompare(b.categoriaId) || a.referenceDate.localeCompare(b.referenceDate));
}
