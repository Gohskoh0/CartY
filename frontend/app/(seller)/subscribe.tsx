import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

export default function Subscribe() {
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [priceInfo, setPriceInfo] = useState<{ ngn_price: number; local_price: number; currency: string; symbol: string } | null>(null);

  useEffect(() => {
    const country = user?.country || 'NG';
    api.getSubscriptionPrice(country)
      .then(setPriceInfo)
      .catch(() => setPriceInfo({ ngn_price: 7500, local_price: 7500, currency: 'NGN', symbol: '₦' }));
  }, [user?.country]);

  const handleSubscribe = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await api.initializeSubscription(email);
      setPaymentUrl(response.authorization_url);
      setReference(response.reference);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationChange = async (navState: any) => {
    const { url } = navState;
    
    // Check if payment was completed
    if (url.includes('callback') || url.includes('success') || url.includes('reference=')) {
      if (reference) {
        try {
          const result = await api.verifySubscription(reference);
          if (result.status === 'success') {
            Alert.alert('Success', 'Your subscription is now active!', [
              { text: 'OK', onPress: () => router.replace('/(seller)/dashboard') },
            ]);
          } else {
            Alert.alert('Failed', 'Subscription verification failed. Please try again.');
          }
        } catch (error) {
          Alert.alert('Error', 'Could not verify subscription');
        }
        setPaymentUrl(null);
      }
    }
  };

  if (paymentUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webviewHeader}>
          <TouchableOpacity onPress={() => setPaymentUrl(null)}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.webviewTitle}>Complete Payment</Text>
          <View style={{ width: 24 }} />
        </View>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={handleNavigationChange}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          )}
        />
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
            {priceInfo ? (
              <>
                <Text style={styles.price}>
                  ₦{priceInfo.ngn_price.toLocaleString()}
                </Text>
                {priceInfo.currency !== 'NGN' && (
                  <Text style={styles.priceConverted}>
                    ≈ {priceInfo.symbol}{priceInfo.local_price.toLocaleString()} {priceInfo.currency}
                  </Text>
                )}
              </>
            ) : (
              <ActivityIndicator color="#C7D2FE" style={{ marginVertical: 8 }} />
            )}
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

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email for receipt"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Subscribe Now</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 16,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  priceCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    color: '#C7D2FE',
    fontSize: 14,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: 'bold',
    marginTop: 8,
  },
  priceConverted: {
    color: '#C7D2FE',
    fontSize: 14,
    marginTop: 4,
  },
  pricePeriod: {
    color: '#C7D2FE',
    fontSize: 14,
    marginTop: 4,
  },
  features: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#A5B4FC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  webviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
