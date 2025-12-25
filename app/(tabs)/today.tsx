// app/(tabs)/today.tsx
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';

import React, { useCallback, useEffect, useRef, useState } from 'react';
// temporary test button (today.tsx)


import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addCompletion,
  addReminder,
  countCompletions,
  deleteReminder,
  listReminders,
  Reminder,
  ScheduleDaily,
} from '../../db/repo/reminders';

export default function TodayScreen() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const router = useRouter();
  const mounted = useRef(true);
  useEffect(() => {
  (async () => {
    // 1️⃣ Ask notification permission (Android 13+ REQUIRED)
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please allow notifications so reminders can alert you.'
        );
        return;
      }
    }

    // 2️⃣ Create notification channel (ANDROID WILL DROP NOTIFS WITHOUT THIS)
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  })();
}, []);


  // load reminders and completion counts
  async function load() {
    try {
      setLoading(true);
      const rows = await listReminders();
      if (!mounted.current) return;
      setItems(rows ?? []);
      const map: Record<string, number> = {};
      await Promise.all(
        (rows ?? []).map(async (r) => {
          try {
            const c = await countCompletions(r.id);
            map[r.id] = c;
          } catch {
            map[r.id] = 0;
          }
        })
      );
      if (!mounted.current) return;
      setCounts(map);
    } catch (err) {
      console.error('load reminders err', err);
      Alert.alert('Error', 'Failed to load reminders. See console.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

 useFocusEffect(
  useCallback(() => {
    load();
    return () => {};
  }, [])
);


  // For tab navigation refresh: re-load whenever screen focuses
  // (expo-router provides useFocusEffect through react-navigation)
  // If you prefer useFocusEffect, you can import and use it; keeping simple here.

  // Developer helper: add a sample reminder (hidden under long-press)
  async function addSample() {
    try {
      const sampleSchedule: ScheduleDaily = { type: 'daily', times: ['08:00'] };
      await addReminder({
        title: 'Take BP tablet',
        description: 'Blood pressure tablet after breakfast',
        icon: 'pill',
        schedule: sampleSchedule,
      });
      await load();
      Alert.alert('Added sample', 'A sample reminder was added (dev).');
    } catch (err) {
      console.error('add sample err', err);
      Alert.alert('Error', 'Failed to add sample reminder. See console.');
    }
  }

  // Request permission and schedule a one-off notification for `secondsFromNow`
  async function scheduleTestNotification(secondsFromNow = 10) {
    try {
      // Request/ensure permissions
const { status: existingStatus } = await Notifications.getPermissionsAsync();
let finalStatus = existingStatus;
if (existingStatus !== 'granted') {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  finalStatus = status;
}


      if (finalStatus !== 'granted') {
        Alert.alert('Notifications disabled', 'Please enable notifications in app settings.');
        return;
      }

      // Create a simple trigger for X seconds. Use `any` to avoid SDK type mismatch across versions.
      const trigger: any = { seconds: Math.max(1, Math.round(secondsFromNow)), repeats: false };

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'RemindMe+ Test',
          body: 'This is a test reminder from RemindMe+',
          sound: true,
        },
        trigger,
      });

      console.log('scheduled test notif', notifId);
      Alert.alert('Scheduled', `Test notification will fire in ${secondsFromNow} seconds.`);
    } catch (err) {
      console.error('schedule test err', err);
      Alert.alert('Error', 'Could not schedule notification. See console.');
    }
  }

  async function onDone(reminder: Reminder) {
    try {
      await addCompletion(reminder.id);
      setCounts((s) => ({ ...s, [reminder.id]: (s[reminder.id] || 0) + 1 }));
      Alert.alert(
        'Marked Done',
        `${reminder.title} — marked done.`,
        [
          {
            text: 'Undo',
            onPress: async () => {
              // local undo only (UI)
              setCounts((s) => ({ ...s, [reminder.id]: Math.max(0, (s[reminder.id] || 1) - 1) }));
              Alert.alert('Undo', 'Undid the last completion locally.');
            },
            style: 'destructive',
          },
          { text: 'OK', style: 'cancel' },
        ],
        { cancelable: true }
      );
    } catch (err) {
      console.error('mark done err', err);
      Alert.alert('Error', 'Failed to mark done. See console.');
    }
  }

  function speakReminder(reminder: Reminder) {
    const title = reminder.title || 'Reminder';
    const desc = reminder.description ? `: ${reminder.description}` : '.';
    const text = `${title}${desc}`;
    try {
      Speech.stop();
      Speech.speak(text, { rate: 0.95 });
    } catch (err) {
      console.error('TTS error', err);
      Alert.alert('TTS Error', 'Could not speak. See console.');
    }
  }
  function formatTime12Hour(time: string) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;

  const hour12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

  function renderItem({ item }: { item: Reminder }) {
    let timesLabel = '';
    try {
      const sched = JSON.parse(item.schedule_json || '{}');
      if (sched.type === 'daily' && Array.isArray(sched.times)) {
        timesLabel = sched.times.join(', ');
      } else if (sched.type === 'weekly') {
        timesLabel = `${(sched.days || []).join(', ')} ${sched.time || ''}`;
      } else if (sched.type === 'interval') {
        timesLabel = `Every ${sched.everyHours}h`;
      }
    } catch {}

    return (
      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.title}</Text>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <Text style={styles.meta}>{formatTime12Hour(timesLabel)}</Text>

          <Text style={styles.meta}>Completed: {counts[item.id] ?? 0}</Text>
        </View>

        <View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
          <Pressable style={styles.speakBtn} onPress={() => speakReminder(item)}>
            <Text style={styles.speakBtnText}>Speak</Text>
          </Pressable>

          <Pressable style={[styles.doneBtn, { marginTop: 8 }]} onPress={() => onDone(item)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>

          <Pressable
            style={[styles.smallBtn, { marginTop: 8 }]}
            onPress={async () => {
              Alert.alert(
                'Delete',
                `Delete "${item.title}"?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await deleteReminder(item.id);
                        await load();
                      } catch (err) {
                        console.error('delete err', err);
                        Alert.alert('Error', 'Could not delete. See console.');
                      }
                    },
                  },
                ],
                { cancelable: true }
              );
            }}
          >
            <Text style={{ color: '#333' }}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}></Text>

      {/* Primary action row */}
      <View style={styles.row}>
        <Pressable
  onPress={() => router.push('/add-reminder')}
  style={{
    backgroundColor: '#34A853',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginBottom: 12,
    marginLeft: 66,
    alignItems: 'center',
  }}
>
  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16,alignItems:'center' }}>
  ➕ Add New Reminder
  </Text>
</Pressable>


      </View>

      {/* Dev-only small helper: long-press header to add sample reminder */}
      <Pressable onLongPress={addSample} style={{ marginTop: 6 }}>
        <Text style={styles.hintText}>Long-press the title to add a sample reminder (dev).</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : items.length === 0 ? (
        <Text style={{ marginTop: 20 }}>No reminders yet — add one.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          style={{ width: '100%', marginTop: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#F5F7FB' },
  header: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', width: '100%', gap: 10, justifyContent: 'space-between' },
  primaryAction: {
    flex: 1,
    backgroundColor: '#34A853',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 6,
  },
  primaryActionText: { color: 'white', fontWeight: '700' },

  secondaryAction: {
    width: 160,
    backgroundColor: '#ffb74d',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryActionText: { color: '#111', fontWeight: '700' },

  hintText: { color: '#777', fontSize: 12, textAlign: 'center' },

  card: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '600' },
  desc: { color: '#444', marginTop: 6 },
  meta: { color: '#666', marginTop: 8, fontSize: 13 },

  speakBtn: {
    backgroundColor: '#4f8ef7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  speakBtnText: { color: 'white', fontWeight: '700' },

  doneBtn: {
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  doneBtnText: { color: 'white', fontWeight: '700' },

  smallBtn: {
    backgroundColor: '#eee',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
});
