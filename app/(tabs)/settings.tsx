// app/(tabs)/settings.tsx
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { getDb, initDb } from '../../db'; // uses your existing db/index.ts

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await initDb();
        await ensureSettingsTable();
        const notif = await readSetting('notificationsEnabled');
        const speak = await readSetting('speechEnabled');

        setNotificationsEnabled(notif === '1' ? true : false);
        setSpeechEnabled(speak === null ? true : speak === '1'); // default true
      } catch (err) {
        console.error('settings init err', err);
        Alert.alert('Error', 'Failed to initialize settings. See console.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- DB helpers (store simple key/value pairs in settings table) ---------- */
  async function ensureSettingsTable() {
    const db = getDb();
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
    } catch (err) {
      console.error('ensureSettingsTable err', err);
      throw err;
    }
  }

  async function writeSetting(key: string, value: string | null) {
    const db = getDb();
    try {
      if (value === null) {
        await db.runAsync('DELETE FROM settings WHERE key = ?;', [key]);
      } else {
        // upsert
        await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`, [key, value]);
      }
    } catch (err) {
      console.error('writeSetting err', err);
      throw err;
    }
  }

  // Type-safe readSetting (fixes the 'unknown' type problem)
  async function readSetting(key: string): Promise<string | null> {
    const db = getDb();
    try {
      // Explicitly cast the result to an array of objects with a `value` property
      const rows = (await db.getAllAsync(
        'SELECT value FROM settings WHERE key = ? LIMIT 1;',
        [key]
      )) as { value: string | null }[];

      if (rows.length > 0 && rows[0].value !== null && rows[0].value !== undefined) {
        return rows[0].value;
      }
      return null;
    } catch (err) {
      console.error('readSetting err', err);
      return null;
    }
  }

  /* ---------- Notification toggle handling ---------- */
  async function toggleNotifications(enabled: boolean) {
    if (enabled) {
      try {
        // ask permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: true },
          });
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert('Permission denied', 'Notifications permission was not granted.');
          return;
        }

        // persist
        await writeSetting('notificationsEnabled', '1');
        setNotificationsEnabled(true);
      } catch (err) {
        console.error('toggleNotifications on err', err);
        Alert.alert('Error', 'Could not enable notifications. See console.');
      }
    } else {
      // turning off
      try {
        await writeSetting('notificationsEnabled', '0');
        setNotificationsEnabled(false);
      } catch (err) {
        console.error('toggleNotifications off err', err);
        Alert.alert('Error', 'Could not disable notifications. See console.');
      }
    }
  }

  /* ---------- Speech toggle ---------- */
  async function toggleSpeech(enabled: boolean) {
    try {
      await writeSetting('speechEnabled', enabled ? '1' : '0');
      setSpeechEnabled(enabled);
    } catch (err) {
      console.error('toggleSpeech err', err);
      Alert.alert('Error', 'Could not change speech setting. See console.');
    }
  }

  /* ---------- Data actions ---------- */
  async function clearReminders() {
    Alert.alert('Clear all reminders', 'This will permanently delete all reminders. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = getDb();
            await db.runAsync('DELETE FROM reminders;');
            Alert.alert('Done', 'All reminders deleted.');
          } catch (err) {
            console.error('clearReminders err', err);
            Alert.alert('Error', 'Could not delete reminders. See console.');
          }
        },
      },
    ]);
  }

  async function clearPeople() {
    Alert.alert('Clear all people', 'This will permanently delete all people and their photos. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const db = getDb();
            await db.runAsync('DELETE FROM people;');
            Alert.alert('Done', 'All people deleted.');
          } catch (err) {
            console.error('clearPeople err', err);
            Alert.alert('Error', 'Could not delete people. See console.');
          }
        },
      },
    ]);
  }

  async function resetAppData() {
    Alert.alert(
      'Reset app data',
      'This will remove reminders, people and settings. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getDb();
              // delete rows (safer than dropping tables)
              await db.runAsync('DELETE FROM reminders;');
              await db.runAsync('DELETE FROM people;');
              await db.runAsync('DELETE FROM settings;');
              // restore defaults
              await writeSetting('speechEnabled', '1');
              await writeSetting('notificationsEnabled', '0');
              setSpeechEnabled(true);
              setNotificationsEnabled(false);
              Alert.alert('Reset', 'App data has been reset.');
            } catch (err) {
              console.error('resetAppData err', err);
              Alert.alert('Error', 'Could not reset app data. See console.');
            }
          },
        },
      ]
    );
  }

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Settings</Text>
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}></Text>

      <View style={styles.row}>
        <Text style={styles.label}>Enable notifications</Text>
        <Switch value={notificationsEnabled} onValueChange={(v) => toggleNotifications(v)} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Speak reminders aloud</Text>
        <Switch value={speechEnabled} onValueChange={(v) => toggleSpeech(v)} />
      </View>

      <View style={{ height: 18 }} />

      <Pressable style={styles.dangerBtn} onPress={clearReminders}>
        <Text style={styles.dangerBtnText}>Clear all reminders</Text>
      </Pressable>

      <Pressable style={[styles.dangerBtn, { marginTop: 10 }]} onPress={clearPeople}>
        <Text style={styles.dangerBtnText}>Clear all people</Text>
      </Pressable>

      <Pressable style={[styles.resetBtn, { marginTop: 18 }]} onPress={resetAppData}>
        <Text style={styles.resetBtnText}>Reset app data</Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Text style={styles.smallNote}>
        RemindMe+ is here to help you stay connected to the moments that matter most. Whether it’s taking medicine, calling a loved one, or remembering a smile — we’ll gently remind you, so you never have to worry about forgetting.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: '#F5F7FB' },
  header: { fontSize: 26, fontWeight: '800', marginBottom: 14, textAlign: 'center' },

  row: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    elevation: 1,
  },
  label: { fontSize: 16, fontWeight: '700' },

  dangerBtn: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#fff', fontWeight: '800' },

  resetBtn: {
    backgroundColor: '#444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetBtnText: { color: '#fff', fontWeight: '700' },

  smallNote: { color: '#666', fontSize: 12, marginTop: 18, textAlign: 'center' },
});
