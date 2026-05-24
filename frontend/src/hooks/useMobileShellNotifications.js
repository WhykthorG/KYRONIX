import { useMemo } from 'react';

export function useMobileShellNotifications({ notifications, isFocusMode }) {
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !notification.dismissed),
    [notifications]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.read).length,
    [visibleNotifications]
  );

  const effectiveUnreadCount = isFocusMode ? 0 : unreadCount;

  const groupedNotifications = useMemo(() => {
    const groups = new Map();
    visibleNotifications.forEach((notification) => {
      const key = notification.group || 'Sistema';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(notification);
    });
    return Array.from(groups.entries());
  }, [visibleNotifications]);

  const unreadBadgesByModuleId = useMemo(() => (
    visibleNotifications.reduce((accumulator, notification) => {
      if (!notification.read && notification.moduleId) {
        accumulator[notification.moduleId] = (accumulator[notification.moduleId] || 0) + 1;
      }
      return accumulator;
    }, {})
  ), [visibleNotifications]);

  return {
    visibleNotifications,
    unreadCount,
    effectiveUnreadCount,
    groupedNotifications,
    unreadBadgesByModuleId,
  };
}
