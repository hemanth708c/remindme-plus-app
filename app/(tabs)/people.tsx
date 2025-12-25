// app/(tabs)/people.tsx
import * as ImagePicker from 'expo-image-picker';
import { saveData, loadData } from '../../lib/storage';
import React, { useEffect, useState } from 'react';

import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addPerson, deletePerson, listPeople, Person } from '../../db/repo/people';

export default function PeopleScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
  loadData('PEOPLE').then(data => {
    if (data && data.length > 0) {
      setPeople(data);
    }
  });
}, []);
useEffect(() => {
  saveData('PEOPLE', people);
}, [people]);

  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // modal for full-screen photo view
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  async function load() {
    try {
      const rows = await listPeople();
      setPeople(rows ?? []);
    } catch (err) {
      console.error('load people err', err);
      Alert.alert('Error', 'Could not load people. See console.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function pickImage() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to gallery to add photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('pickImage err', err);
      Alert.alert('Error', 'Could not pick image. See console.');
    }
  }

  async function onAdd() {
  if (!name.trim()) {
    Alert.alert('Missing info', 'Please enter the person’s name.');
    return;
  }

  try {
    // Normalise the field we send to the repo: send photoUri as 'photo_uri'
    await addPerson({
  name: name.trim(),
  relation: relation.trim(),
  notes: notes.trim(),
  photoUri: photoUri || null, // ✅ notice camelCase
});

    setName('');
    setRelation('');
    setNotes('');
    setPhotoUri(null);
    await load();
    Alert.alert('Saved', `${name.trim()} added.`);
  } catch (err) {
    console.error('add person err', err);
    Alert.alert('Error', 'Could not add person.');
  }
}
  async function onDelete(id: string) {
    Alert.alert('Delete', 'Are you sure you want to delete this person?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePerson(id);
            await load();
          } catch (err) {
            console.error('delete person err', err);
            Alert.alert('Error', 'Could not delete person. See console.');
          }
        },
      },
    ]);
  }

  function openViewer(uri: string | null) {
    if (!uri) return;
    setViewerUri(uri);
    setViewerVisible(true);
  }

  function renderItem({ item }: { item: Person }) {
  // tolerate both database field names
  const uri = (item as any).photo_uri ?? (item as any).photoUri ?? null;
  const displayImage = uri ? { uri } : require('../../assets/placeholder.png');

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => openViewer(uri)}>
        <Image source={displayImage as any} style={styles.photo} />
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.name}>{item.name}</Text>
        {item.relation ? <Text style={styles.relation}>{item.relation}</Text> : null}
        {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      </View>

      <Pressable style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

  return (
    <View style={styles.container}>
      <Text style={styles.header}></Text>

      <TextInput
        placeholder="👤 Name"
        placeholderTextColor="#6b6b6b"
        style={styles.input}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Name"
      />

      <TextInput
        placeholder="🤝 Relation (e.g. Daughter, Friend)"
        placeholderTextColor="#6b6b6b"
        style={styles.input}
        value={relation}
        onChangeText={setRelation}
      />

      <TextInput
        placeholder="📝 Notes (optional)"
        placeholderTextColor="#6b6b6b"
        style={[styles.input, { height: 60 }]}
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      <Pressable style={styles.photoBtn} onPress={pickImage}>
        <Text style={styles.photoBtnText}>{photoUri ? 'Change Photo' : 'Add Photo'}</Text>
      </Pressable>

      <Pressable style={styles.saveBtn} onPress={onAdd}>
        <Text style={styles.saveBtnText}>Save Person</Text>
      </Pressable>

      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        style={{ marginTop: 20, width: '100%' }}
        ListEmptyComponent={<Text style={styles.empty}>No people added yet.</Text>}
      />

      {/* Fullscreen photo viewer modal */}
      <Modal
        visible={viewerVisible}
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
        transparent={false}
      >
        <View style={styles.viewerContainer}>
          <Pressable
            style={styles.viewerClose}
            onPress={() => {
              setViewerVisible(false);
              setViewerUri(null);
            }}
          >
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>

          <View style={styles.viewerImageWrap}>
            {viewerUri ? (
              <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
            ) : (
              <Text style={{ color: '#fff' }}>No image</Text>
            )}
          </View>

          {Platform.OS === 'android' && (
            <Pressable
              style={styles.viewerCloseBottom}
              onPress={() => {
                setViewerVisible(false);
                setViewerUri(null);
              }}
            >
              <Text style={styles.viewerCloseText}>Close</Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FB', padding: 18 },
  header: { fontSize: 26, fontWeight: '700', marginBottom: 12, textAlign: 'center' },

  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 10,
    color: '#111',
  },

  photoBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  photoBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  saveBtn: {
    backgroundColor: '#2ecc71',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
  },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#eee' },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { fontSize: 24, color: '#666' },

  name: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 2 },
  relation: { color: '#444', fontSize: 14 },
  notes: { color: '#666', marginTop: 6 },

  deleteBtn: {
    backgroundColor: '#ff6961',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  empty: { textAlign: 'center', color: '#666', marginTop: 20 },

  /* Viewer modal */
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerClose: {
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  viewerCloseBottom: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#111',
  },
  viewerCloseText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  viewerImageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
});
