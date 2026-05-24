# Implementation Plan - React Hooks and State Refactoring

This plan outlines the refactoring steps to address ESLint configurations, React hook issues, state synchronization, and code organization across the codebase.

## User Review Required

We will refactor several key page components (`TeacherCalendar`, `UserManagement`, `Desktop`, `MobileShellRoot`) to extract domain logic, API queries, and state management into custom hooks and `useReducer`. This will significantly reduce the size of these components and separate UI rendering from data orchestration.

No breaking changes to the user experience or component API contracts are expected.

## Proposed Changes

---

### ESLint & Hooks Configuration

#### [MODIFY] [eslint.config.js](file:///c:/Users/Home/Desktop/TCC/eslint.config.js)
- Extend file targeting from specific folders to all frontend source files: `frontend/src/**/*.{js,mjs,cjs,jsx,ts,tsx}`.
- Update ignore patterns to match the new root-relative workspace structure (e.g. `frontend/src/lib/**/*` and `frontend/src/components/ui/**/*`).
- Enable `react-hooks/exhaustive-deps` rule as a warning (`"react-hooks/exhaustive-deps": "warn"`).

#### [MODIFY] [useArrayState.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useArrayState.js)
- Fix missing React import by importing `useState` alongside `useCallback` on line 1.

---

### Hook Dependencies & State Synchronization

#### [MODIFY] [App.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/App.jsx)
- Wrap `canAccessPage` in `useCallback` to prevent recreation on every render.
- Add `canAccessPage` to the dependency array of the routing `useEffect` (line 200).

#### [MODIFY] [UserRoleDialog.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/components/usermanagement/UserRoleDialog.jsx)
- Add a `useEffect` that updates the `selectedRole` state with the `currentRole` prop when the dialog opens (`isOpen` goes from false to true).

#### [MODIFY] [StudentPhotoReviewDialog.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/components/usermanagement/StudentPhotoReviewDialog.jsx)
- Replace `useMemo(() => requests.length, [requests.length])` with direct assignment: `const pendingCount = requests.length;`.

---

### AuthContext State Refactoring

#### [MODIFY] [AuthContext.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/lib/AuthContext.jsx)
- Implement `authReducer` managing `user`, `session`, and `isLoadingAuth` state actions.
- Derive `isAuthenticated` directly from `state.user` or `state.session` (reducing duplicate state variables).
- Refactor `AuthProvider` to use `useReducer` and dispatch actions for session initialization, login successes, and logout.

---

### Teacher Calendar Refactoring

#### [NEW] [useTeacherCalendarData.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useTeacherCalendarData.js)
- Build a custom hook containing calendar data fetching, syncing, exporting, and consolidation.
- Use `useReducer` to manage loading, syncing, exporting, and data state transitions.

#### [MODIFY] [TeacherCalendar.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/pages/TeacherCalendar.jsx)
- In the `EventDialog` component, add an `else` branch to the `useEffect` checking `event` to clear/reset the form state to default fields when creating a new event (preventing stale data retention).
- Integrate the custom hook `useTeacherCalendarData` in the main component.
- Remove redundant state variables (`loading`, `syncing`, `exporting`, `events`, `schoolEvents`, `classes`, `assignments`, `diaryEntries`) and rely on the hook instead.

---

### User Management Refactoring

#### [NEW] [useUserManagementData.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useUserManagementData.js)
- Extract user profiles, classes, students, and guardian link queries/mutations into this custom hook.

#### [NEW] [useGuardianLinkEditor.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useGuardianLinkEditor.js)
- Extract the complex checkbox list and editing links logic (e.g. tracking and toggling linked student IDs, sync logic) into this custom hook.

#### [MODIFY] [UserManagement.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/pages/UserManagement.jsx)
- Replace independent state variables for modal control, selection, and password resets with a single `useReducer` (`userManagementReducer`).
- Incorporate `useUserManagementData` and `useGuardianLinkEditor` hooks.

---

### Desktop & Mobile Shell Refactoring

#### [NEW] [useWorkspacePersistence.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useWorkspacePersistence.js)
- Extract the remote/local workspace state queries, hydration `useEffect`, and debounced saving/updates from `Desktop.jsx` into this hook.

#### [NEW] [useDesktopShortcutsLayout.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useDesktopShortcutsLayout.js)
- Extract the ResizeObserver logic, grid boundaries, and icon repositioning computations from `Desktop.jsx` into this hook.

#### [MODIFY] [Desktop.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/pages/Desktop.jsx)
- Clean up `Desktop` component by utilizing the two new custom hooks.

#### [NEW] [useMobileShellEnvironment.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useMobileShellEnvironment.js)
- Extract state and effects for system clock, system dark mode, and browser connectivity from `MobileShellRoot.jsx` into this hook.

#### [NEW] [useMobileShellNotifications.js](file:///c:/Users/Home/Desktop/TCC/frontend/src/hooks/useMobileShellNotifications.js)
- Extract state, grouping operations, and badge counting logic for active notifications from `MobileShellRoot.jsx`.

#### [MODIFY] [MobileShellRoot.jsx](file:///c:/Users/Home/Desktop/TCC/frontend/src/components/mobile-shell/MobileShellRoot.jsx)
- Update component to consume the two new hooks, simplifying code readability.

---

### Test Suite Alignment

#### [MODIFY] [systemEvents.js](file:///c:/Users/Home/Desktop/TCC/shared/src/contracts/systemEvents.js)
- Update the system event definition for `SYSTEM_EXPORT_COMPLETED` (around lines 118-120) to change the producer path from `server/systemExportServer.js` to `backend/src/services/systemExportServer.js` to align with the actual folder layout and fix the pre-existing test failure in `tests/premium-foundation.integration.test.js`.

---

## Verification Plan

### Automated Tests
- Run ESLint to verify that no style/hook rules are violated:
  `npm.cmd run lint`
- Run the test suite:
  `npm.cmd test`

### Manual Verification
- Test creating a user, assigning roles, and editing dialogs in User Management.
- Test loading, filtering, creating, and editing events in the Teacher Calendar.
- Verify workspace state persistence across desktop reloads.
- Verify that mobile shell environment variables (clock, dark mode, connection status) function correctly.
