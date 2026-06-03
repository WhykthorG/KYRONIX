export const apiRouteManifest = [
  { pattern: ['admin', 'enrollments'], loadHandler: () => import('../../../backend/src/routes/admin/enrollments.js').then((module) => module.default) },
  { pattern: ['admin', 'profiles'], loadHandler: () => import('../../../backend/src/routes/admin/profiles.js').then((module) => module.default) },
  { pattern: ['admin', 'system-export'], loadHandler: () => import('../../../backend/src/routes/admin/system-export.js').then((module) => module.default) },
  { pattern: ['admin', 'users'], loadHandler: () => import('../../../backend/src/routes/admin/users.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'audit-log'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/audit-log.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'conflicts'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/conflicts.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'generate'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/generate.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'manual-edits'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/manual-edits.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'optimization'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/optimization.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'publish'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/publish.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'questionnaires'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/questionnaires.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'settings'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/settings.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'structures'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/structures.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'suggestions'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/suggestions.js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'versions'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/versions.js').then((module) => module.default) },
  { pattern: ['attendance', 'lesson'], loadHandler: () => import('../../../backend/src/routes/attendance/lesson.js').then((module) => module.default) },
  { pattern: ['audit', 'events'], loadHandler: () => import('../../../backend/src/routes/audit/events.js').then((module) => module.default) },
  { pattern: ['chat', 'media-url'], loadHandler: () => import('../../../backend/src/routes/chat/media-url.js').then((module) => module.default) },
  { pattern: ['chat', 'calls', 'start'], loadHandler: () => import('../../../backend/src/routes/chat/calls/start.js').then((module) => module.default) },
  { pattern: ['chat', 'conversations'], loadHandler: () => import('../../../backend/src/routes/chat/conversations/index.js').then((module) => module.default) },
  { pattern: ['guardian', 'documents'], loadHandler: () => import('../../../backend/src/routes/guardian/documents.js').then((module) => module.default) },
  { pattern: ['guardian', 'monthly-report'], loadHandler: () => import('../../../backend/src/routes/guardian/monthly-report.js').then((module) => module.default) },
  { pattern: ['guardian', 'students'], loadHandler: () => import('../../../backend/src/routes/guardian/students.js').then((module) => module.default) },
  { pattern: ['messages'], loadHandler: () => import('../../../backend/src/routes/messages/index.js').then((module) => module.default) },
  { pattern: ['notifications'], loadHandler: () => import('../../../backend/src/routes/notifications/index.js').then((module) => module.default) },
  { pattern: ['observability', 'events'], loadHandler: () => import('../../../backend/src/routes/observability/events.js').then((module) => module.default) },
  { pattern: ['security', 'me', 'profile'], loadHandler: () => import('../../../backend/src/routes/security/me/profile.js').then((module) => module.default) },
  { pattern: ['admin', 'users', '[userId]'], loadHandler: () => import('../../../backend/src/routes/admin/users/[userId].js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'generations', '[id]'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/generations/[id].js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'suggestions', '[id]'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/suggestions/[id].js').then((module) => module.default) },
  { pattern: ['admin', 'schedule-planner', 'versions', '[id]'], loadHandler: () => import('../../../backend/src/routes/admin/schedule-planner/versions/[id].js').then((module) => module.default) },
  { pattern: ['chat', 'calls', '[callId]', 'end'], loadHandler: () => import('../../../backend/src/routes/chat/calls/[callId]/end.js').then((module) => module.default) },
  { pattern: ['chat', 'calls', '[callId]', 'join'], loadHandler: () => import('../../../backend/src/routes/chat/calls/[callId]/join.js').then((module) => module.default) },
  { pattern: ['chat', 'calls', '[callId]', 'recordings'], loadHandler: () => import('../../../backend/src/routes/chat/calls/[callId]/recordings.js').then((module) => module.default) },
  { pattern: ['chat', 'calls', '[callId]', 'signals'], loadHandler: () => import('../../../backend/src/routes/chat/calls/[callId]/signals.js').then((module) => module.default) },
  { pattern: ['notifications', '[notificationId]'], loadHandler: () => import('../../../backend/src/routes/notifications/[notificationId].js').then((module) => module.default) },
  { pattern: ['security', 'supabase', '[...path]'], loadHandler: () => import('../../../backend/src/routes/security/supabase/[...path].js').then((module) => module.default) },
];

function getDynamicParamName(patternSegment) {
  if (!patternSegment.startsWith('[') || !patternSegment.endsWith(']')) {
    return null;
  }

  return patternSegment.slice(1, -1);
}

export function resolveApiHandlerFromManifest(segments, routes = apiRouteManifest) {
  for (const route of routes) {
    const params = {};
    let matched = true;

    for (let index = 0; index < route.pattern.length; index += 1) {
      const patternSegment = route.pattern[index];
      const catchAllName = patternSegment.startsWith('[...') && patternSegment.endsWith(']')
        ? patternSegment.slice(4, -1)
        : null;

      if (catchAllName) {
        if (segments.length <= index) {
          matched = false;
          break;
        }

        params[catchAllName] = segments.slice(index);
        return {
          loadHandler: route.loadHandler,
          params,
          pattern: route.pattern,
        };
      }

      const segment = segments[index];
      const paramName = getDynamicParamName(patternSegment);

      if (paramName) {
        if (!segment) {
          matched = false;
          break;
        }

        params[paramName] = segment;
        continue;
      }

      if (patternSegment !== segment) {
        matched = false;
        break;
      }
    }

    if (matched && route.pattern.length === segments.length) {
      return {
        loadHandler: route.loadHandler,
        params,
        pattern: route.pattern,
      };
    }
  }

  return null;
}
