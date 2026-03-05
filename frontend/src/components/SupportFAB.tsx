import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SupportFAB() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: 90 + (insets.bottom > 0 ? insets.bottom : 0) }]}
      onPress={() => router.push('/(seller)/support')}
      activeOpacity={0.85}
    >
      <View style={styles.inner}>
        <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    zIndex: 100,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  inner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
