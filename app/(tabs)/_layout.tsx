// app/(tabs)/_layout.tsx
import { FontAwesome5 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        // slightly smaller label and heavier weight so it fits better
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        // give each tab more horizontal space so labels don't clip
        tabBarItemStyle: { paddingHorizontal: 8 },
        tabBarStyle: { height: 70, paddingBottom: 6 },
        tabBarActiveTintColor: '#0b84ff',
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="calendar-day" size={size ?? 20} color={color} />
          ),
          // render label as component so it can wrap if needed
          tabBarLabel: ({ focused }) => (
            <Text style={{ fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              Today
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="users" size={size ?? 20} color={color} />
          ),
          tabBarLabel: () => (
            <Text style={{ fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              People
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="memory-tests"
        options={{
          title: 'Memory Games',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="brain" size={size ?? 20} color={color} />
          ),
          // custom label (this lets the label wrap to two lines if needed)
          tabBarLabel: () => (
            <Text style={{ fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              Memory Games
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="cog" size={size ?? 20} color={color} />
          ),
          tabBarLabel: () => (
            <Text style={{ fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              Settings
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
