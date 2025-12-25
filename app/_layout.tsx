// app/_layout.tsx
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { initDb } from '../db';
import { registerNotificationListeners, requestNotificationPermissions } from '../lib/notifications';


// idempotent DB init on app start
export const unstable_settings = {
  // optional
};

export default function RootLayout() {
  useEffect(() => {
  async function setup() {
    try {
      await initDb(); // prepare DB first
      await requestNotificationPermissions(); // ask user for notification access
      registerNotificationListeners(); // make TTS + notifications respond properly
    } catch (err) {
      console.error('App setup error', err);
    }
  }

  setup();
}, []);


  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        {/* main tabs container (your tab screens live under app/(tabs)) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Add Reminder presented as a modal (full screen, no tab bar underneath) */}
        <Stack.Screen
          name="add-reminder"
          options={{ presentation: 'modal', headerShown: true, title: 'Add Reminder' }}
        />

        {/* keep existing modal if you have other modal routes */}
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
