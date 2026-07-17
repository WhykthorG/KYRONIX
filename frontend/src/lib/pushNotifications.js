// Serviço de Notificações Push — EduGest
// Whykthor GSV

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

let swRegistration = null;

export async function initializePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[push] Push notifications not supported in this browser.');
    return false;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    console.log('[push] Service worker registered.');
    return true;
  } catch (error) {
    console.error('[push] Service worker registration failed:', error);
    return false;
  }
}

export async function requestPushPermission() {
  if (!('Notification' in window)) {
    console.warn('[push] Notifications not supported.');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeToPush() {
  if (!swRegistration) {
    await initializePushNotifications();
  }

  if (!swRegistration) {
    throw new Error('Service worker not registered.');
  }

  const permission = await requestPushPermission();
  if (permission !== 'granted') {
    throw new Error('Push notification permission denied.');
  }

  try {
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });

    return subscription;
  } catch (error) {
    console.error('[push] Subscription failed:', error);
    throw error;
  }
}

export async function unsubscribeFromPush() {
  if (!swRegistration) return;

  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[push] Unsubscribed from push notifications.');
    }
  } catch (error) {
    console.error('[push] Unsubscribe failed:', error);
  }
}

export async function getPushSubscription() {
  if (!swRegistration) return null;

  try {
    return await swRegistration.pushManager.getSubscription();
  } catch (error) {
    console.error('[push] Get subscription failed:', error);
    return null;
  }
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushPermissionState() {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}
