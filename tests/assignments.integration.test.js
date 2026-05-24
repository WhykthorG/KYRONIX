// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ASSIGNMENT_STATUSES,
  buildPublishedAssignmentUpdate,
  isAssignmentPublished,
  normalizeAssignmentStatus,
  shouldAutoCloseAssignment,
} from '../shared/src/contracts/assignments.js';

test('buildPublishedAssignmentUpdate publishes with the canonical schema status', () => {
  const published = buildPublishedAssignmentUpdate({
    id: 'assignment-1',
    title: 'Projeto final',
    status: ASSIGNMENT_STATUSES.DRAFT,
  }, '2026-03-30T15:00:00.000Z');

  assert.equal(published.status, ASSIGNMENT_STATUSES.PUBLISHED);
  assert.equal(published.published_at, '2026-03-30T15:00:00.000Z');
});

test('assignment publication visibility accepts canonical and legacy rollout values', () => {
  assert.equal(normalizeAssignmentStatus('publicada'), ASSIGNMENT_STATUSES.PUBLISHED);
  assert.equal(isAssignmentPublished({ status: 'publicado' }), true);
  assert.equal(isAssignmentPublished({ status: 'publicada' }), true);
  assert.equal(isAssignmentPublished({ status: ASSIGNMENT_STATUSES.DRAFT }), false);
});

test('assignment auto-close rule only applies to published overdue activities without late submission', () => {
  assert.equal(
    shouldAutoCloseAssignment({
      status: ASSIGNMENT_STATUSES.PUBLISHED,
      due_date: '2026-04-01T10:00:00.000Z',
      allow_late_submission: false,
    }, new Date('2026-04-02T10:00:00.000Z')),
    true
  );

  assert.equal(
    shouldAutoCloseAssignment({
      status: ASSIGNMENT_STATUSES.PUBLISHED,
      due_date: '2026-04-01T10:00:00.000Z',
      allow_late_submission: true,
    }, new Date('2026-04-02T10:00:00.000Z')),
    false
  );

  assert.equal(
    shouldAutoCloseAssignment({
      status: ASSIGNMENT_STATUSES.DRAFT,
      due_date: '2026-04-01T10:00:00.000Z',
      allow_late_submission: false,
    }, new Date('2026-04-02T10:00:00.000Z')),
    false
  );
});

test('assignment tracking schema supports per-student visualization monitoring', () => {
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );
  const migration = fs.readFileSync(
    new URL('../supabase/migration_assignment_views.sql', import.meta.url),
    'utf8'
  );

  assert.match(schema, /CREATE TABLE IF NOT EXISTS assignment_views \(/);
  assert.match(schema, /UNIQUE \(assignment_id, student_id\)/);
  assert.match(schema, /CREATE POLICY "student manage own assignment views" ON assignment_views/);
  assert.match(schema, /CREATE POLICY "teacher read assignment views" ON assignment_views/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.assignment_views/);
  assert.match(migration, /auth_has_permission\('submissions\.read\.all'\)/);
});

test('assignment schema supports min and max group member limits', () => {
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );

  assert.match(schema, /min_group_size\s+INTEGER/);
  assert.match(schema, /max_group_size\s+INTEGER/);
});
