import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

export default function Subscribe() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // OTP step
  const [otpStep, setOtpStep] = useState(false);
  const [otpText, setOtpText] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [chargeRef, setChargeRef] = useState('');

  const handlePay = async () => {
    const cardNum = cardNumber.replace(/\s/g, '');
    const expParts = expiry.split('/');
    const expM = expParts[0]?.trim() || '';
    const expYRaw = expParts[1]?.trim() || '';
    const expY = expYRaw.length === 2 ? '20' + expYRaw : expYRaw;

    if (cardNum.length < 15 || !expM || expYRaw.length < 2 || cvv.length < 3) {
      Alert.alert('Error', 'Please fill in all card details');
      return;
    }

    setLoading(true);
    Keyboard.dismiss();
    try {
      const response = await api.chargeSubscriptionCard({
        card_number: cardNum,
        expiry_month: expM,
        expiry_year: expY,
        cvv,
      });

      if (response.status === 'success') {
        Alert.alert('Success', 'Your store is now active!', [
          { text: 'OK', onPress: () => router.replace('/(seller)/dashboard') },
        ]);
      } else if (response.status === 'send_otp' || response.status === 'send_pin' || response.status === 'send_phone') {
        setChargeRef(response.reference);
        setOtpText(response.display_text || 'Enter the OTP sent to you');
        setOtpStep(true);
      } else if (response.status === 'open_url' && response.url) {
        await Linking.openURL(response.url);
      } else {
        Alert.alert('Error', response.message || 'Payment failed. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!otpValue.trim()) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      const result = await api.submitSubscriptionOtp(chargeRef, otpValue.trim());
      if (result.status === 'success') {
        Alert.alert('Success', 'Your store is now active!', [
          { text: 'OK', onPress: () => router.replace('/(seller)/dashboard') },
        ]);
      } else {
        Alert.alert('Failed', result.message || 'OTP verification failed. Please try again.');
        setOtpStep(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (otpStep) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setOtpStep(false)}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark-outline" size={64} color="#4F46E5" />
          </View>
          <Text style={styles.title}>Verify Payment</Text>
          <Text style={styles.subtitle}>{otpText}</Text>
          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter OTP"
            placeholderTextColor="#9CA3AF"
            value={otpValue}
            onChangeText={setOtpValue}
            keyboardType="number-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmitOtp}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Ionicons name="rocket-outline" size={64} color="#4F46E5" />
          </View>

          <Text style={styles.title}>Activate Your Store</Text>
          <Text style={styles.subtitle}>
            Subscribe to start accepting payments from your customers
          </Text>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Monthly Subscription</Text>
            <Text style={styles.price}>$7</Text>
            <Text style={styles.pricePeriod}>per month</Text>
          </View>

          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.featureText}>Accept payments from customers</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.featureText}>Receive order notifications</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.featureText}>Withdraw earnings anytime</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.featureText}>WhatsApp order alerts</Text>
            </View>
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Payment Details</Text>

            <Text style={styles.label}>Card Number</Text>
            <TextInput
              style={styles.input}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor="#9CA3AF"
              value={cardNumber}
              onChangeText={(v) => setCardNumber(formatCardNumber(v))}
              keyboardType="number-pad"
              maxLength={19}
              returnKeyType="next"
            />

            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <Text style={styles.label}>Expiry Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/YY"
                  placeholderTextColor="#9CA3AF"
                  value={expiry}
                  onChangeText={(v) => setExpiry(formatExpiry(v))}
                  keyboardType="number-pad"
                  maxLength={5}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.rowHalf}>
                <Text style={styles.label}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="CVV"
                  placeholderTextColor="#9CA3AF"
                  value={cvv}
                  onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handlePay}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Pay $7.00</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 16 },
  content: { flexGrow: 1, padding: 24 },
  iconContainer: {
    alignSelf: 'center', width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  priceCard: {
    backgroundColor: '#4F46E5', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 24,
  },
  priceLabel: { color: '#C7D2FE', fontSize: 14 },
  price: { color: '#FFFFFF', fontSize: 48, fontWeight: 'bold', marginTop: 8 },
  pricePeriod: { color: '#C7D2FE', fontSize: 14, marginTop: 4 },
  features: { marginBottom: 24 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 16, color: '#374151', marginLeft: 12 },
  cardSection: {
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardSectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111827', marginBottom: 16, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  row: { flexDirection: 'row', gap: 12 },
  rowHalf: { flex: 1 },
  button: {
    backgroundColor: '#4F46E5', borderRadius: 12, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: '#A5B4FC' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
});
