import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED = [
  'How do I add a product?',
  "Why can't I withdraw?",
  'How do I share my store?',
];

export default function SupportScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    try {
      const payload = updated.map(m => ({ role: m.role, content: m.content }));
      const res = await api.supportChat(payload);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.message }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>C</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>C</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>CartY Support</Text>
            <Text style={styles.headerSub}>AI-powered assistant</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles" size={48} color="#6366F1" />
            </View>
            <Text style={styles.emptyTitle}>How can I help?</Text>
            <Text style={styles.emptySub}>Ask me anything about your CartY store</Text>
            <View style={styles.suggestions}>
              {SUGGESTED.map(q => (
                <TouchableOpacity key={q} style={styles.chip} onPress={() => send(q)}>
                  <Text style={styles.chipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>C</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about CartY..."
            placeholderTextColor="#64748B"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0F1E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2A3C',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerTitle: { color: '#F8FAFC', fontWeight: '700', fontSize: 15 },
  headerSub: { color: '#94A3B8', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#1F2A3C', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  suggestions: { gap: 10, width: '100%' },
  chip: {
    backgroundColor: '#1F2A3C', borderRadius: 12, paddingVertical: 12,
    paddingHorizontal: 16, borderWidth: 1, borderColor: '#2D3B52',
  },
  chipText: { color: '#94A3B8', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUser: { backgroundColor: '#6366F1', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#1F2A3C', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2D3B52' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAssistant: { color: '#F8FAFC' },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: {
    backgroundColor: '#1F2A3C', borderRadius: 16, borderBottomLeftRadius: 4,
    paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#2D3B52',
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#1F2A3C', backgroundColor: '#111827',
  },
  input: {
    flex: 1, backgroundColor: '#1F2A3C', borderRadius: 20, borderWidth: 1,
    borderColor: '#2D3B52', paddingHorizontal: 16, paddingVertical: 10,
    color: '#F8FAFC', fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#312E81' },
});
