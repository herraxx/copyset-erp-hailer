// Finnish (fi-FI) formatting helpers — currency, dates, decimals.

export function formatEUR(value: unknown): string {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '0,00 €';
  return n.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
}

export function formatNumber(value: unknown, decimals = 0): string {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return '-';
  return n.toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Matches the reference's FI_DATE(): always 2-digit day/month, e.g. "05.09.2026".
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2013';
  const ms = typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : Number(value);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '\u2013';
  return new Intl.DateTimeFormat('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatDateTime(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2013';
  const ms = typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : Number(value);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '\u2013';
  return formatDate(ms) + ' ' + d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
}

export function toDateInputValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const ms = typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : Number(value);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// Composes a printable one-line address from the structured delivery
// fields — kept in sync with the legacy flat "Toimitusosoite" field so
// documents that still read the flat field (Lähete, Lähetyslappu) show the
// primary address even though editing now happens via the structured
// fields in the form.
export function composeAddress(parts: {
  vastaanottaja?: string;
  katuosoite?: string;
  postinumero?: string;
  kaupunki?: string;
  maa?: string;
  lisatiedot?: string;
}): string {
  const line1 = parts.vastaanottaja?.trim();
  const line2 = parts.katuosoite?.trim();
  const line3 = [parts.postinumero?.trim(), parts.kaupunki?.trim()].filter(Boolean).join(' ');
  const line4 = parts.maa?.trim() && parts.maa.trim() !== 'Suomi' ? parts.maa.trim() : '';
  const line5 = parts.lisatiedot?.trim();
  return [line1, line2, line3, line4, line5].filter(Boolean).join('\n');
}

export function isOverdue(deadlineValue: unknown): boolean {
  if (!deadlineValue) return false;
  const ms = typeof deadlineValue === 'number' && deadlineValue < 10_000_000_000 ? deadlineValue * 1000 : Number(deadlineValue);
  if (Number.isNaN(ms)) return false;
  return ms < Date.now();
}

function toLocalDateOnly(value: unknown): Date | null {
  if (!value) return null;
  const ms = typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : Number(value);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Matches the reference's "Tänään" quick filter: deadline falls on today's local date.
export function isDueToday(deadlineValue: unknown): boolean {
  const d = toLocalDateOnly(deadlineValue);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
}

// Matches the reference's "Tällä viikolla" quick filter: deadline falls
// between today and the end of the current ISO week (Sunday), inclusive.
export function isDueThisWeek(deadlineValue: unknown): boolean {
  const d = toLocalDateOnly(deadlineValue);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay() || 7;
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (7 - dayOfWeek));
  return d.getTime() >= today.getTime() && d.getTime() <= weekEnd.getTime();
}

// ActivityLink read helper — {_id,name} | [{_id,name}] | string | undefined
export function readLink(v: unknown): { id?: string; name?: string } {
  if (Array.isArray(v)) {
    const first = v[0] as { _id?: string; name?: string } | undefined;
    return { id: first?._id, name: first?.name };
  }
  if (v && typeof v === 'object') {
    const o = v as { _id?: string; name?: string };
    return { id: o._id, name: o.name };
  }
  if (typeof v === 'string') return { id: v };
  return {};
}

export function readValue<T = unknown>(v: unknown): T | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'object' && v !== null && 'value' in (v as Record<string, unknown>)) {
    return (v as { value: T }).value;
  }
  return v as T;
}
