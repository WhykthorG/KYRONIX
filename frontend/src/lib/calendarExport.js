// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
function escapeIcsText(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUtcDateTime(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('') + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('');
}

function addDays(date, days) {
  return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

function addHours(date, hours) {
  return new Date(date.getTime() + (hours * 60 * 60 * 1000));
}

function normalizeCalendarEntry(entry, index) {
  const start = toDate(entry?.start);
  if (!start) return null;

  const allDay = Boolean(entry?.allDay);
  const requestedEnd = toDate(entry?.end);
  const end = requestedEnd && requestedEnd > start
    ? requestedEnd
    : allDay
      ? addDays(start, 1)
      : addHours(start, 1);

  const uidBase = entry?.uid || entry?.id || `${index}-${formatUtcDateTime(start)}`;

  return {
    uid: `${uidBase}@projectwg.local`,
    title: entry?.title || 'Evento',
    description: entry?.description || '',
    location: entry?.location || '',
    url: entry?.url || '',
    allDay,
    start,
    end,
    categories: Array.isArray(entry?.categories) ? entry.categories.filter(Boolean) : [],
  };
}

function buildIcsEvent(entry) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(entry.uid)}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `SUMMARY:${escapeIcsText(entry.title)}`,
  ];

  if (entry.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(entry.start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateOnly(entry.end)}`);
  } else {
    lines.push(`DTSTART:${formatUtcDateTime(entry.start)}`);
    lines.push(`DTEND:${formatUtcDateTime(entry.end)}`);
  }

  if (entry.description) lines.push(`DESCRIPTION:${escapeIcsText(entry.description)}`);
  if (entry.location) lines.push(`LOCATION:${escapeIcsText(entry.location)}`);
  if (entry.url) lines.push(`URL:${escapeIcsText(entry.url)}`);
  if (entry.categories.length > 0) lines.push(`CATEGORIES:${entry.categories.map(escapeIcsText).join(',')}`);

  lines.push('END:VEVENT');
  return lines;
}

export function buildIcsCalendar(entries = [], { calendarName = 'Calendario', prodId = '-//Project WG//Calendario//PT-BR' } = {}) {
  const normalizedEntries = entries
    .map((entry, index) => normalizeCalendarEntry(entry, index))
    .filter(Boolean);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  normalizedEntries.forEach((entry) => {
    lines.push(...buildIcsEvent(entry));
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildCalendarFilename(baseName = 'calendario-professor', now = new Date()) {
  const safeBaseName = String(baseName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'calendario-professor';

  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('');

  return `${safeBaseName}-${stamp}.ics`;
}
