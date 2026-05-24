import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { computeWindowId, useDesktopShellStore } from '../frontend/src/lib/stores/desktopShellStore.js';

test.beforeEach(() => {
  useDesktopShellStore.getState().resetShell();
});

test('closing the active window promotes the next top visible window and syncs focus flags', () => {
  const store = useDesktopShellStore.getState();
  store.openWindow('dashboard');
  store.openWindow('students');
  store.closeWindow('students');

  const next = useDesktopShellStore.getState();
  assert.equal(next.activeWindowId, 'dashboard');
  assert.deepEqual(
    next.windows.map((window) => ({
      id: window.id,
      focused: window.focused,
      minimized: window.minimized,
    })),
    [{ id: 'dashboard', focused: true, minimized: false }]
  );
});

test('minimizing the active window restores focus to the next visible window', () => {
  const store = useDesktopShellStore.getState();
  store.openWindow('dashboard');
  store.openWindow('students');
  store.minimizeWindow('students');

  const next = useDesktopShellStore.getState();
  const dashboard = next.windows.find((window) => window.id === 'dashboard');
  const students = next.windows.find((window) => window.id === 'students');

  assert.equal(next.activeWindowId, 'dashboard');
  assert.equal(dashboard?.focused, true);
  assert.equal(students?.minimized, true);
  assert.equal(students?.focused, false);
});

test('toggling always-on-top keeps a single focused window', () => {
  const store = useDesktopShellStore.getState();
  store.openWindow('dashboard');
  store.openWindow('students');
  store.toggleAlwaysOnTop('dashboard');

  const next = useDesktopShellStore.getState();
  const focusedWindows = next.windows.filter((window) => window.focused);
  const dashboard = next.windows.find((window) => window.id === 'dashboard');

  assert.equal(next.activeWindowId, 'dashboard');
  assert.equal(focusedWindows.length, 1);
  assert.equal(focusedWindows[0]?.id, 'dashboard');
  assert.equal(dashboard?.alwaysOnTop, true);
});

test('record-mode window ids remain stable for the same context key', () => {
  const app = {
    id: 'student-profile',
    window: {
      mode: 'record',
      key: ({ studentId }) => studentId,
    },
  };

  assert.equal(
    computeWindowId(app, { studentId: 'abc-123' }),
    'student-profile:abc-123'
  );
  assert.equal(
    computeWindowId(app, {}, { studentId: 'abc-123' }),
    'student-profile:abc-123'
  );
});

test('desktop windows expose explicit resize handles and live resize updates', () => {
  const source = fs.readFileSync(new URL('../frontend/src/components/desktop/Window.jsx', import.meta.url), 'utf8');

  assert.match(source, /enableResizing=\{WINDOW_RESIZE_HANDLES\}/);
  assert.match(source, /onResize=\{handleResize\}/);
  assert.match(source, /onResizeStart=\{\(\) => \{/);
  assert.match(source, /resizeHandleStyles=\{WINDOW_RESIZE_HANDLE_STYLES\}/);
  assert.match(source, /min-h-0 min-w-0 flex-1 overflow-auto/);
});

test('desktop enters an idle overlay mode after inactivity', () => {
  const desktopSource = fs.readFileSync(new URL('../frontend/src/pages/Desktop.jsx', import.meta.url), 'utf8');
  const inactivityHookSource = fs.readFileSync(new URL('../frontend/src/hooks/useUserInactivity.js', import.meta.url), 'utf8');

  assert.match(inactivityHookSource, /DEFAULT_IDLE_TIMEOUT_MS = 90_000/);
  assert.match(inactivityHookSource, /ACTIVITY_EVENTS = \['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'\]/);
  assert.match(desktopSource, /useUserInactivity\(\{/);
  assert.match(desktopSource, /hidden=\{startOpen \|\| idleModeActive\}/);
  assert.match(desktopSource, /forceClosed=\{startOpen \|\| idleModeActive\}/);
  assert.match(desktopSource, /<DesktopIdleOverlay/);
});
