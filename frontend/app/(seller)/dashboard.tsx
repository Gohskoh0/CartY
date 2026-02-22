import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
  ActivityIndicator,
  Clipboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.log('Dashboard error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, []);

  const getStoreUrl = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    return `${baseUrl}/store/${dashboard?.store_slug}`;
  };

  const handleShareStore = async () => {
    if (!dashboard?.store_slug) {
      Alert.alert('Store Not Ready', 'Please create your store first to share it.');
      return;
    }
    
    const storeUrl = getStoreUrl();
    
    try {
      const result = await Share.share({
        message: `🛒 Check out my store on CartY!\n\n${storeUrl}`,
        title: 'Share My Store',
      });
      
      if (result.action === Share.dismissedAction) {
        // User dismissed
      }
    } catch (error) {
      // Fallback to copy to clipboard if share fails
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    if (!dashboard?.store_slug) {
      Alert.alert('Store Not Ready', 'Please create your store first.');
      return;
    }
    const storeUrl = getStoreUrl();
    
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(storeUrl);
      } else {
        Clipboard.setString(storeUrl);
      }
      Alert.alert('Copied!', 'Store link copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isSubscribed = dashboard?.subscription_status === 'active';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back!</Text>
            <Text style={[styles.storeName, { color: colors.text }]}>{user?.phone}</Text>
          </View>
          <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primaryLight }]} onPress={handleShareStore}>
            <Ionicons name="share-social-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {!isSubscribed && (
          <TouchableOpacity
            style={[styles.subscriptionBanner, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(seller)/subscribe')}
          >
            <View style={styles.bannerContent}>
              <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>Activate Your Store</Text>
                <Text style={styles.bannerSubtitle}>
                  Subscribe for ₦37,500/month to start accepting payments
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {isSubscribed && (
          <View style={[styles.activeBadge, { backgroundColor: colors.successLight }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.activeBadgeText, { color: colors.success }]}>Store Active</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="cart-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{dashboard?.total_orders || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Orders</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="trending-up-outline" size={24} color={colors.success} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ₦{(dashboard?.total_sales || 0).toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Sales</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="wallet-outline" size={24} color={colors.warning} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ₦{(dashboard?.wallet_balance || 0).toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wallet Balance</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="cube-outline" size={24} color={colors.error} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{dashboard?.products_count || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Products</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/(seller)/add-product')}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Add Product</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]} 
              onPress={handleShareStore}
            >
              <Ionicons name="link-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Share Store</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Orders</Text>
          {dashboard?.recent_orders?.length > 0 ? (
            dashboard.recent_orders.map((order: any) => (
              <View key={order._id} style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.orderHeader}>
                  <Text style={[styles.orderBuyer, { color: colors.text }]}>{order.buyer_name}</Text>
                  <View
                    style={[
                      styles.orderStatus,
                      { backgroundColor: colors.warningLight },
                      order.status === 'completed' && { backgroundColor: colors.successLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderStatusText,
                        { color: colors.warning },
                        order.status === 'completed' && { color: colors.success },
                      ]}
                    >
                      {order.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.orderAmount, { color: colors.text }]}>
                  ₦{(order.total_amount || 0).toLocaleString()}
                </Text>
                <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No orders yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>Share your store link to get started!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  greeting: {
    fontSize: 14,
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerText: {
    marginLeft: 12,
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bannerSubtitle: {
    color: '#C7D2FE',
    fontSize: 12,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontWeight: '600',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  statCard: {
    width: '50%',
    padding: 8,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontWeight: '600',
    marginLeft: 8,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderBuyer: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderDate: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
