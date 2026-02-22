import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { api } from '../../../src/services/api';

export default function Checkout() {
  const { slug, cart: cartParam } = useLocalSearchParams<{ slug: string; cart: string }>();
  const router = useRouter();
  const cart = cartParam ? JSON.parse(cartParam) : [];

  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);

  const cartTotal = cart.reduce(
    (sum: number, item: any) => sum + item.product.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (!buyerName || !buyerPhone || !buyerAddress) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.checkout(slug as string, {
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        buyer_address: buyerAddress,
        buyer_note: buyerNote || undefined,
        cart_items: cart.map((item: any) => ({
          product_id: item.product._id,
          quantity: item.quantity,
        })),
      });

      if (response.status === 'subscription_required') {
        Alert.alert(
          'Store Not Active',
          response.message,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Contact Seller',
              onPress: () => Linking.openURL(response.whatsapp_link),
            },
          ]
        );
      } else if (response.status === 'success') {
        setPaymentUrl(response.authorization_url);
        setReference(response.reference);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationChange = async (navState: any) => {
    const { url } = navState;

    if (url.includes('callback') || url.includes('success') || url.includes('reference=')) {
      if (reference) {
        setPaymentUrl(null);
        setLoading(true);
        try {
          const result = await api.verifyPayment(slug as string, reference);
          if (result.status === 'success') {
            setOrderSuccess(true);
            setWhatsappLink(result.whatsapp_link);
          } else {
            Alert.alert('Payment Failed', 'Your payment could not be verified. Please try again.');
          }
        } catch (error) {
          Alert.alert('Error', 'Could not verify payment');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  if (orderSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successText}>
            Your order has been placed successfully. The seller will contact you soon.
          </Text>

          {whatsappLink && (
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={() => Linking.openURL(whatsappLink)}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              <Text style={styles.whatsappButtonText}>Notify Seller on WhatsApp</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.backToStoreButton}
            onPress={() => router.replace(`/store/${slug}`)}
          >
            <Text style={styles.backToStoreText}>Back to Store</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            {cart.map((item: any) => (
              <View key={item.product._id} style={styles.orderItem}>
                <Text style={styles.orderItemName}>
                  {item.product.name} x{item.quantity}
                </Text>
                <Text style={styles.orderItemPrice}>
                  ₦{(item.product.price * item.quantity).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>₦{cartTotal.toLocaleString()}</Text>
            </View>
          </View>

          {/* Delivery Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              value={buyerName}
              onChangeText={setBuyerName}
            />

            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor="#9CA3AF"
              value={buyerPhone}
              onChangeText={setBuyerPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Delivery Address *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter your delivery address"
              placeholderTextColor="#9CA3AF"
              value={buyerAddress}
              onChangeText={setBuyerAddress}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any special instructions..."
              placeholderTextColor="#9CA3AF"
              value={buyerNote}
              onChangeText={setBuyerNote}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            onPress={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.payButtonText}>Pay ₦{cartTotal.toLocaleString()}</Text>
                <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderItemName: {
    fontSize: 14,
    color: '#374151',
  },
  orderItemPrice: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
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
  textArea: {
    height: 80,
    paddingTop: 14,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 56,
  },
  payButtonDisabled: {
    backgroundColor: '#A5B4FC',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
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
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  whatsappButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backToStoreButton: {
    paddingVertical: 12,
  },
  backToStoreText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '600',
  },
});
