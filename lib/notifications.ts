// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { getDb, initDb } from '../db';

/**
 * scheduleLocalNotification
 * Uses a time-interval trigger (seconds from now) which is broadly compatible across Expo SDKs.
 */
export async function scheduleLocalNotification(
  id: string,
  date: Date,
  title: string,
  body?: string
) {
  try {
    // ✅ ensure Android channel BEFORE scheduling
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const ms = date.getTime() - Date.now();
    const seconds = Math.max(1, Math.round(ms / 1000));

    const trigger = {
      seconds,
      repeats: false,
    } as Notifications.TimeIntervalTriggerInput;

    const notifId = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true },
      trigger,
    });

    console.log('📅 Scheduled notification', id, 'secondsFromNow:', seconds);
    return notifId;
  } catch (err) {
    console.error('scheduleLocalNotification error', err);
    throw err;
  }
}

/* ------------------ Helpers to read "speechEnabled" from DB ------------------ */
async function isSpeechEnabled(): Promise<boolean> {
  try {
    await initDb();
    const db = getDb();
    const rows = (await db.getAllAsync(
      'SELECT value FROM settings WHERE key = "speechEnabled" LIMIT 1;'
    )) as { value: string | null }[];

    if (rows.length > 0 && rows[0].value === '1') return true;
    return false;
  } catch (err) {
    console.error('isSpeechEnabled err', err);
    return true; // safe fallback
  }
}

/* ------------------ Notification event handlers ------------------ */
export async function handleNotificationResponse(response: Notifications.NotificationResponse) {
  try {
    const data = response.notification.request.content;
    const title = data.title ?? 'Reminder';
    const body = data.body ?? '';

    const speakEnabled = await isSpeechEnabled();
    if (speakEnabled) {
      const text = body ? `${title}. ${body}` : title;
      Speech.speak(text, { rate: 0.95 });
    }

    console.log('Notification response handled:', response);
  } catch (err) {
    console.error('handleNotificationResponse err', err);
  }
}

export async function handleNotificationReceived(notification: Notifications.Notification) {
  try {
    // This runs when a notification arrives while the app is foregrounded.
    console.log('Notification received (foreground):', notification);
    // Optionally speak immediately when received (if you want)
    // const speakEnabled = await isSpeechEnabled();
    // if (speakEnabled) {
    //   const title = notification.request.content.title ?? 'Reminder';
    //   const body = notification.request.content.body ?? '';
    //   const text = body ? `${title}. ${body}` : title;
    //   Speech.speak(text, { rate: 0.95 });
    // }
  } catch (err) {
    console.error('handleNotificationReceived err', err);
  }
}

/* ------------------ Channel + listeners registration ------------------ */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    // AndroidImportance may be undefined on older SDK types; fallback to 4 (HIGH)
    const importance = (Notifications.AndroidImportance as any) ?? 4;
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: importance,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    console.log('✅ Android channel ensured');
  } catch (err) {
    console.error('ensureAndroidChannel err', err);
  }
}

/**
 * Call this once at app startup (root layout). It registers both received + response listeners
 * and ensures Android channel exists.
 */
export function registerNotificationListeners() {
  try {
    // ensure channel immediately (async but non-blocking)
    ensureAndroidChannel();

    // received in foreground
    Notifications.addNotificationReceivedListener(handleNotificationReceived);

    // response (tapped) handler
    Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    console.log('✅ Notification listeners registered');
  } catch (err) {
    console.error('registerNotificationListeners err', err);
  }
}

/* ------------------ Permission helper ------------------ */
export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    });

    if (status !== 'granted') {
      console.warn('Notifications permission not granted:', status);
      throw new Error('Notifications permission not granted');
    }
  } catch (err) {
    console.error('requestNotificationPermissions err', err);
    throw err;
  }
}

/* ------------------ Debug helpers you can call from UI ------------------ */
export async function debug_checkPermissions() {
  try {
    const perms = await Notifications.getPermissionsAsync();
    console.log('DEBUG: notification permissions:', perms);
    return perms;
  } catch (err) {
    console.error('debug_checkPermissions err', err);
    return null;
  }
}

export async function debug_listScheduled() {
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    console.log('DEBUG scheduled notifications:', list);
    return list;
  } catch (err) {
    console.error('debug_listScheduled err', err);
    return [];
  }
}

export async function debug_cancelAll() {
  try {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    const ids = list.map((n) => n.identifier);
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    console.log('DEBUG: cancelled scheduled ids:', ids);
    return ids;
  } catch (err) {
    console.error('debug_cancelAll err', err);
    return [];
  }
}

/**
 * Schedule a quick immediate test notification (5 seconds from now).
 * Use this from a button or call in a temporary useEffect to test.
 */
export async function debug_scheduleImmediateTest(title = 'Test Reminder', body = 'This is a test') {
  try {
    const date = new Date(Date.now() + 5000);
    const ms = date.getTime() - Date.now();
    const seconds = Math.max(1, Math.round(ms / 1000));
    const trigger = ({ seconds, repeats: false } as unknown) as Notifications.NotificationTriggerInput;

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger,
    });

    console.log('DEBUG: scheduled immediate test id=', id, 'seconds=', seconds);
    return id;
  } catch (err) {
    console.error('debug_scheduleImmediateTest err', err);
    throw err;
  }
}
