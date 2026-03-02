import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

type Step = 'phone' | 'otp' | 'password';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');

  // Step 1
  const [phone, setPhone] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  // Step 2
  const [code, setCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setSendingOtp(true);
    try {
      await api.sendOtp(phone.trim(), 'forgot_password');
      setStep('otp');
      startCountdown();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }
    setStep('password');
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      await api.sendOtp(phone.trim(), 'forgot_password');
      startCountdown();
      setCode('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setResetting(true);
    try {
      await api.resetPassword(phone.trim(), code, newPassword);
      Alert.alert('Success', 'Your password has been reset. Please sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const stepNumber = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => step === 'phone' ? router.back() : setStep(step === 'otp' ? 'phone' : 'otp')}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Steps indicator */}
          <View style={styles.stepsRow}>
            {[1, 2, 3].map(n => (
              <View key={n} style={styles.stepItem}>
                <View style={[styles.stepDot, n <= stepNumber && styles.stepDotActive]}>
                  {n < stepNumber ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.stepDotText, n === stepNumber && styles.stepDotTextActive]}>{n}</Text>
                  )}
                </View>
                {n < 3 && <View style={[styles.stepLine, n < stepNumber && styles.stepLineActive]} />}
              </View>
            ))}
          </View>

          {/* Step 1: Enter Phone */}
          {step === 'phone' && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your registered phone number and we'll send you a reset code.
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.button, sendingOtp && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Code</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Enter OTP */}
          {step === 'otp' && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>Enter Code</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to
              </Text>
              <Text style={styles.phoneHighlight}>{phone}</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor="#D1D5DB"
                value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, (verifyingOtp || code.length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={verifyingOtp || code.length !== 6}
              >
                {verifyingOtp ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>
              <View style={styles.resendRow}>
                <Text style={styles.resendLabel}>Didn't receive a code? </Text>
                <TouchableOpacity onPress={handleResend} disabled={countdown > 0 || resending}>
                  {resending ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : (
                    <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3: New Password */}
          {step === 'password' && (
            <View style={styles.stepContent}>
              <Text style={styles.title}>New Password</Text>
              <Text style={styles.subtitle}>
                Choose a strong password for your account.
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  placeholderTextColor="#9CA3AF"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, resetting && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={resetting}
              >
                {resetting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  topRow: { marginBottom: 24 },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#4F46E5' },
  stepDotText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  stepDotTextActive: { color: '#FFFFFF' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', width: 40, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#4F46E5' },
  stepContent: { flex: 1 },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 22,
  },
  phoneHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: 28,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  codeInput: {
    width: '100%',
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#4F46E5',
    backgroundColor: '#F9FAFB',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
    letterSpacing: 12,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#A5B4FC' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  resendLabel: { color: '#6B7280', fontSize: 15 },
  resendLink: { color: '#4F46E5', fontSize: 15, fontWeight: '600' },
  resendDisabled: { color: '#9CA3AF' },
});
