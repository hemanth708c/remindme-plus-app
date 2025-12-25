// app/(tabs)/memory-tests.tsx
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { listPeople, Person } from '../../db/repo/people';

// placeholder image — make sure remindme-plus/assets/placeholder.png exists
const placeholderImage = require('../../assets/placeholder.png');

type QuizItem = {
  id: string;
  name: string;
  relation?: string;
  photoUri?: string | null;
};

export default function MemoryTestsScreen() {
  const router = useRouter();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // quiz state
  const [quizOrder, setQuizOrder] = useState<QuizItem[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [questionType, setQuestionType] = useState<'name' | 'relation'>('name');

  // fade animation
  const fade = useMemo(() => new Animated.Value(0), []);

  // helper: shuffle
  function shuffleArray<T>(arr: T[]) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // build quiz order from people (normalise relation & photo fields)
  function buildQuizOrder(): QuizItem[] {
    return (people || []).map((p) => ({
      id: p.id,
      name: p.name,
      relation: p.relation ?? undefined, // never null
      photoUri: (p as any).photo_uri ?? (p as any).photoUri ?? null,
    }));
  }

  // load people (used by focus effect)
  const loadPeople = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPeople();
      setPeople(rows ?? []);
    } catch (err) {
      console.error('load people for quiz err', err);
      Alert.alert('Error', 'Could not load people. See console.');
    } finally {
      setLoading(false);
    }
  }, []);

  // reload whenever tab is focused
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        if (!mounted) return;
        await loadPeople();
      })();
      return () => {
        mounted = false;
      };
    }, [loadPeople])
  );

  // if people list changes while a quiz is running, stop/reset the quiz
  useEffect(() => {
    if (running) {
      // stop quiz to avoid stale entries
      setRunning(false);
      setQuizOrder([]);
      setCurrentRound(0);
      setChoices([]);
      setShowResultModal(false);
    }
  }, [people]);

  // rounds = number of people
  const roundsCount = quizOrder.length;

  function buildChoicesFor(item: QuizItem, type: 'name' | 'relation') {
    const pool = (people || [])
      .map((p) => ({
        name: p.name,
        relation: p.relation ?? '',
      }))
      .filter((p) => (type === 'name' ? p.name !== item.name : p.relation !== (item.relation ?? '')));

    const wrong = shuffleArray(pool).slice(0, Math.min(3, pool.length));
    const correct = type === 'name' ? item.name : item.relation ?? '(no relation)';

    const labels = wrong.map((w) => (type === 'name' ? w.name : w.relation || '(no relation)'));
    labels.push(correct);
    return shuffleArray(labels);
  }

  function prepareRound(item: QuizItem, type: 'name' | 'relation') {
    setQuestionType(type);
    const ch = buildChoicesFor(item, type);
    setChoices(ch);
  }

  function startQuiz() {
    if (!people || people.length === 0) {
      Alert.alert('No people', 'Add people in the People tab first to play the memory game.');
      return;
    }

    const order = shuffleArray(buildQuizOrder());
    setQuizOrder(order);
    setCurrentRound(0);
    setScore(0);
    setRunning(true);
    setShowResultModal(false);
    setQuestionType('name');

    // prepare first round
    prepareRound(order[0], 'name');
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }

  function handleChoiceSelection(choice: string) {
    if (!running || quizOrder.length === 0) return;
    const item = quizOrder[currentRound];
    const correct = questionType === 'name' ? item.name : item.relation ?? '(no relation)';
    const isCorrect = choice === correct;
    if (isCorrect) setScore((s) => s + 1);

    if (questionType === 'name') {
      // ask relation next for same person
      prepareRound(item, 'relation');
      return;
    } else {
      // finished both questions for this item -> next person
      const nextIndex = currentRound + 1;
      if (nextIndex >= quizOrder.length) {
        // finished all rounds
        setRunning(false);
        setShowResultModal(true);
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      } else {
        setCurrentRound(nextIndex);
        Animated.sequence([
          Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        prepareRound(quizOrder[nextIndex], 'name');
      }
    }
  }

  function restartQuiz() {
    startQuiz();
  }

  function finishAndClose() {
    setShowResultModal(false);
    setRunning(false);
    setQuizOrder([]);
    setCurrentRound(0);
    setChoices([]);
  }

  // total questions = people * 2
  const totalQuestions = Math.max(1, roundsCount * 2);
  const percent = Math.round((score / totalQuestions) * 100);

  // UI
  function renderQuestionArea() {
    if (!running || quizOrder.length === 0) {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.subheader}>Start a new quiz to test memory</Text>
          <Pressable style={styles.primaryAction} onPress={startQuiz}>
            <Text style={styles.primaryActionText}>Start Quiz</Text>
          </Pressable>
        </View>
      );
    }

    const item = quizOrder[currentRound];
    if (!item) return null;

    const displayImage = item.photoUri ? { uri: item.photoUri } : placeholderImage;

    return (
      <Animated.View style={[styles.quizWrap, { opacity: fade }]}>
        <View style={{ width: '100%', alignItems: 'center' }}>
          <Text style={styles.roundText}>
            Person {currentRound + 1} / {roundsCount}
          </Text>
          <Text style={styles.scoreText}>Score: {score} / {totalQuestions}</Text>
        </View>

        <View style={styles.imageWrap}>
          <Image source={displayImage as any} style={styles.image} resizeMode="cover" />
        </View>

        <Text style={styles.questionLabel}>
          {questionType === 'name' ? 'Who is this person?' : 'What is their relation?'}
        </Text>

        <View style={styles.choicesWrap}>
          {choices.map((c, idx) => (
            <Pressable
              key={`${c}__${idx}`}
              style={styles.choiceBtn}
              onPress={() => handleChoiceSelection(c)}
            >
              <Text style={styles.choiceText}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <Pressable style={styles.secondaryAction} onPress={restartQuiz}>
            <Text style={styles.secondaryActionText}>Restart</Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryAction, { backgroundColor: '#ddd' }]}
            onPress={() => {
              finishAndClose();
              router.back();
            }}
          >
            <Text style={[styles.secondaryActionText, { color: '#111' }]}>Back</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}></Text>
      <Text style={styles.subheader}>
        Test recognition of people. Quiz length = number of people. Two questions per person: name + relation.
      </Text>

      {loading ? <Text style={{ marginTop: 20 }}>Loading people…</Text> : renderQuestionArea()}

      {/* Result modal */}
      <Modal visible={showResultModal} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Quiz finished</Text>
            <Text style={styles.modalMsg}>You scored {score} out of {totalQuestions} ({percent}%)</Text>

            {percent >= 70 ? (
              <Text style={styles.modalCongrats}>Great job! 🎉</Text>
            ) : (
              <Text style={styles.modalEncourage}>Nice try — keep practising!</Text>
            )}

            <View style={{ flexDirection: 'row', marginTop: 18 }}>
  <Pressable
    style={{
      flex: 1,
      backgroundColor: '#4CAF50',
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onPress={() => {
      restartQuiz();
      setShowResultModal(false);
    }}
  >
    <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
      Play Again
    </Text>
  </Pressable>

  <Pressable
    style={{
      flex: 1,
      backgroundColor: '#E0E0E0',
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 15,
    }}
    onPress={() => {
      finishAndClose();
    }}
  >
    <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>
      Close
    </Text>
  </Pressable>
</View>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: '#F5F7FB' },
  header: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subheader: { color: '#666', marginTop: 8, marginBottom: 18, textAlign: 'center' },

  centerBox: { alignItems: 'center', marginTop: 24 },

  quizWrap: { marginTop: 6, width: '100%', alignItems: 'center' },
  roundText: { fontSize: 14, fontWeight: '700', color: '#333' },
  scoreText: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 6 },

  imageWrap: {
    width: 220,
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    elevation: 2,
  },
  image: { width: '100%', height: '100%' },

  questionLabel: { fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 8 },

  choicesWrap: { width: '100%' },
  choiceBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 8,
  },
  choiceText: { fontSize: 16, color: '#111' },

  primaryAction: {
    backgroundColor: '#34A853',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryActionText: { color: '#fff', fontWeight: '800' },

  secondaryAction: {
    backgroundColor: '#0b84ff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryActionText: { color: '#fff', fontWeight: '700' },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  modalHeader: { fontSize: 22, fontWeight: '800' },
  modalMsg: { marginTop: 10, color: '#333' },
  modalCongrats: { marginTop: 10, color: '#2ecc71', fontWeight: '800' },
  modalEncourage: { marginTop: 10, color: '#ff8c42', fontWeight: '700' },
});
