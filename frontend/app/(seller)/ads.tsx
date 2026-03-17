import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';

export default function Ads() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.card }]}>
          <Ionicons name="megaphone-outline" size={48} color="#4F46E5" />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Ads</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Coming Soon</Text>
        </View>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Run targeted ads on Meta (Facebook & Instagram) and TikTok directly from CartY.
          We're putting the finishing touches on this feature.
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Stay tuned for updates.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.6,
  },
});
