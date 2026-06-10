// Phone verification has been disabled for launch.
// This screen is kept as a placeholder to avoid route resolution errors.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function VerifyOtp() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verification disabled</Text>
      <Text style={styles.subtitle}>
        {phone ? `Account for ${phone} is created without phone OTP verification.` : 'Your account is created without phone OTP verification.'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 10, color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  button: { backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

