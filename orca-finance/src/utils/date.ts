function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function removeDateConnectors(value: string): string {
  return value
    .replace(/ de /g, ' ')
    .replace(/\./g, '');
}

export function formatDashboardDate(date: string): string {
  const parsedDate = parseLocalDate(date);

  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
  }).format(parsedDate);

  const dayAndMonth = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(parsedDate);

  return `${weekday}, ${removeDateConnectors(dayAndMonth)}`;
}

export function formatTransactionDateTime(
  date: string,
  time: string,
  referenceDate: string
): string {
  if (date === referenceDate) {
    return `Hoje, ${time}`;
  }

  const parsedDate = parseLocalDate(date);

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);

  return removeDateConnectors(formattedDate);
}

export function formatTransactionDate(date: string): string {
  return removeDateConnectors(new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(parseLocalDate(date)));
}
// Permite digitar datas com o teclado numérico Android, que não oferece barras.
export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBrazilianDateToISO(
  value: string
): string | null {
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const [, dayText, monthText, yearText] = match;

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  const date = new Date(
    year,
    month - 1,
    day
  );

  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

export function isValidTime(
  value: string
): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function localDate(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function timestampToLocal(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error('Timestamp inválido.');
  return { date: localDate(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` };
}

export function localDateTimeToISO(day: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isValidTime(time)) throw new Error('Data/hora inválidas.');
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const local = new Date(0);
  local.setFullYear(year, month - 1, date);
  local.setHours(hour, minute, 0, 0);
  if (localDate(local) !== day || local.getHours() !== hour || local.getMinutes() !== minute) throw new Error('Data/hora inválidas.');
  return local.toISOString();
}

export function filterDateBoundary(day: string, end = false): string {
  const date = new Date(localDateTimeToISO(day, '00:00'));
  if (end) { date.setDate(date.getDate() + 1); date.setMilliseconds(-1); }
  return date.toISOString();
}

// Períodos de calendário enviados como DATE; a API agrega em UTC.
export function calendarPeriod(monthKey: string, windowMonths = 1) {
  if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(monthKey) || !Number.isInteger(windowMonths) || windowMonths < 1) throw new Error('Período inválido.');
  const [year, month] = monthKey.split('-').map(Number);
  if (year < 1) throw new Error('Período inválido.');
  const start = new Date(0); start.setUTCFullYear(year, month - windowMonths, 1); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(0); end.setUTCFullYear(year, month, 0); end.setUTCHours(0, 0, 0, 0);
  if (start.getUTCFullYear() < 1) throw new Error('Período inválido.');
  return { year, month, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}
export function shiftMonth(monthKey: string, offset: number) {
  const { year, month } = calendarPeriod(monthKey);
  const date = new Date(0); date.setUTCFullYear(year, month - 1 + offset, 1);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) throw new Error('Período inválido.');
  return date.toISOString().slice(0, 7);
}
