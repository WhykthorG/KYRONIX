// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCalendarFilename, buildIcsCalendar } from '../frontend/src/lib/calendarExport.js';

test('buildIcsCalendar exports timed and all-day events in ICS format', () => {
  const content = buildIcsCalendar([
    {
      id: 'meeting-1',
      title: 'Reuniao Pedagogica',
      description: 'Revisao do plano semanal',
      location: 'Sala 02',
      start: new Date('2026-03-31T12:00:00.000Z'),
      end: new Date('2026-03-31T13:30:00.000Z'),
      categories: ['Reuniao'],
    },
    {
      id: 'holiday-1',
      title: 'Conselho de Classe',
      start: new Date(2026, 3, 1),
      allDay: true,
      categories: ['Calendario Escolar'],
    },
  ], { calendarName: 'Calendario de Teste' });

  assert.match(content, /BEGIN:VCALENDAR/);
  assert.match(content, /X-WR-CALNAME:Calendario de Teste/);
  assert.match(content, /SUMMARY:Reuniao Pedagogica/);
  assert.match(content, /DTSTART:20260331T120000Z/);
  assert.match(content, /DTEND:20260331T133000Z/);
  assert.match(content, /DTSTART;VALUE=DATE:20260401/);
  assert.match(content, /DTEND;VALUE=DATE:20260402/);
  assert.match(content, /CATEGORIES:Calendario Escolar/);
});

test('buildCalendarFilename normalizes names for download-safe files', () => {
  const filename = buildCalendarFilename('Calendario do Professor Joao', new Date(2026, 2, 31, 8, 45));
  assert.equal(filename, 'calendario-do-professor-joao-20260331-0845.ics');
});
