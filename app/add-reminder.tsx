import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from 'react-native';

import { listPeople, Person } from '../db/repo/people';
import { addReminder } from '../db/repo/reminders';
import { scheduleLocalNotification } from '../lib/notifications';

export default function AddReminderScreen() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const p = await listPeople();
          if (mounted) setPeople(p);
        } catch (err) {
          console.error(err);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [])
  );

  function getSelectedPerson() {
    return people.find((p) => p.id === selectedPersonId);
  }

  async function onSave() {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a reminder title.');
      return;
    }

    const hh = time.getHours().toString().padStart(2, '0');
    const mm = time.getMinutes().toString().padStart(2, '0');
    const timeString = `${hh}:${mm}`;

    const now = new Date();
    const scheduleDate = new Date(time);
    if (scheduleDate.getTime() <= now.getTime()) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }

    try {
      const newId = await addReminder({
        title: title.trim(),
        description: description.trim(),
        icon: 'bell',
        schedule: { type: 'daily', times: [timeString] },
        personId: selectedPersonId ?? null,
      });

      await scheduleLocalNotification(
        `reminder-${newId}`,
        scheduleDate,
        title.trim(),
        description.trim() || undefined
      );

      router.replace('/');
    } catch (err) {
      Alert.alert('Error', 'Could not save reminder.');
    }
  }

  function renderPersonItem({ item }: { item: Person }) {
    const selected = item.id === selectedPersonId;
    return (
      <Pressable
        onPress={() => {
          setSelectedPersonId(item.id);
          setDropdownOpen(false);
        }}
        style={[
          styles.personRow,
          selected ? styles.personSelected : styles.personUnselected,
        ]}
      >
        <Text style={selected ? styles.personTextSelected : styles.personText}>
          {item.name} {item.relation ? `• ${item.relation}` : ''}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Reminder title"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Time</Text>
        <Pressable style={styles.timeInput} onPress={() => setShowTimePicker(true)}>
          <Text style={styles.timeValue}>
            {time.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
          <Text style={styles.timeIcon}>⏰</Text>
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, t) => {
              setShowTimePicker(false);
              if (t) setTime(t);
            }}
          />
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>For</Text>
        <Pressable
          style={styles.dropdownTrigger}
          onPress={() => setDropdownOpen((s) => !s)}
        >
          <Text
            style={
              getSelectedPerson()
                ? styles.dropdownText
                : styles.dropdownPlaceholder
            }
          >
            {getSelectedPerson()
              ? `${getSelectedPerson()!.name}${
                  getSelectedPerson()!.relation
                    ? ` • ${getSelectedPerson()!.relation}`
                    : ''
                }`
              : 'Select person (optional)'}
          </Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>

        {dropdownOpen && (
          <View style={styles.dropdownList}>
            <FlatList
              data={people}
              keyExtractor={(p) => p.id}
              renderItem={renderPersonItem}
            />
          </View>
        )}

        <Pressable style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveBtnText}>Save Reminder</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
    padding: 16,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 4,
  },

  label: {
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '500',
    color: '#374151',
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },

  timeInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },

  timeValue: {
    fontSize: 16,
    color: '#111827',
  },

  timeIcon: {
    fontSize: 16,
    color: '#6B7280',
  },

  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },

  dropdownPlaceholder: {
    color: '#9CA3AF',
  },

  dropdownText: {
    color: '#111827',
    fontWeight: '500',
  },

  chevron: {
    color: '#6B7280',
  },

  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 6,
    backgroundColor: '#fff',
    maxHeight: 200,
  },

  personRow: {
    padding: 10,
    borderRadius: 8,
  },

  personUnselected: {
    backgroundColor: '#fff',
  },

  personSelected: {
    backgroundColor: '#2563EB',
  },

  personText: {
    color: '#111827',
  },

  personTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  saveBtn: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
