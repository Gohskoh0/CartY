import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Share, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';
import * as Clipboard from 'expo-clipboard';

function StatCard({ icon, label, value, iconBg, iconColor }: any) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    if (user && !user.has_store) router.replace('/(seller)/create-store');
  }, [user]);

  const fetchDashboard = async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('store not found') || msg.includes('404')) {
        router.replace('/(seller)/create-store');
        return;
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchDashboard(); }, []);

  const getStoreUrl = () => `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/store/${dashboard?.store_slug}`;

  const handleShareStore = async () => {
    if (!dashboard?.store_slug) return Alert.alert('Not ready', 'Create your store first.');
    try {
      await Share.share({ message: `Check out my store on CartY!\n\n${getStoreUrl()}` });
    } catch {
      await Clipboard.setStringAsync(getStoreUrl());
      Alert.alert('Copied!', 'Store link copied to clipboard');
    }
  };

  const handleCopyLink = async () => {
    if (!dashboard?.store_slug) return;
    await Clipboard.setStringAsync(getStoreUrl());
    Alert.alert('Copied!', 'Store link copied to clipboard');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isSubscribed = dashboard?.subscription_status === 'active';
  const storeName = dashboard?.store_name || user?.phone || 'Your Store';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.storeAvatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.storeAvatarText, { color: colors.primary }]}>
              {(storeName[0] || 'S').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting} 👋</Text>
            <Text style={[styles.storeName, { color: colors.text }]} numberOfLines={1}>{storeName}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(seller)/settings')}
          style={[styles.settingsBtn, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* Subscription Banner */}
        {!isSubscribed && (
          <TouchableOpacity
            style={[styles.subBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            onPress={() => router.push('/(seller)/subscribe')}
          >
            <Ionicons name="flash" size={16} color={colors.primary} />
            <Text style={[styles.subBannerText, { color: colors.primary }]}>
              Activate your store to accept payments — $7/month
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Wallet Balance</Text>
              {balanceVisible ? (
                <Text style={[styles.balanceAmount, { color: colors.text }]}>
                  ₦{(dashboard?.wallet_balance || 0).toLocaleString()}
                </Text>
              ) : (
                <Text style={[styles.balanceHidden, { color: colors.text }]}>••••••</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setBalanceVisible(v => !v)}>
              <Ionicons name={balanceVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.balanceActions}>
            <TouchableOpacity
              style={[styles.balanceAction, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(seller)/wallet')}
            >
              <Ionicons name="arrow-up-outline" size={16} color="#fff" />
              <Text style={styles.balanceActionText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.balanceAction, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => router.push('/(seller)/wallet')}
            >
              <Ionicons name="card-outline" size={16} color={colors.text} />
              <Text style={[styles.balanceActionText, { color: colors.text }]}>Bank Setup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              icon="receipt-outline" label="Orders" value={dashboard?.total_orders || 0}
              iconBg={colors.primaryLight} iconColor={colors.primary}
            />
            <StatCard
              icon="trending-up-outline" label="Revenue" value={`₦${((dashboard?.total_sales || 0) / 1000).toFixed(0)}K`}
              iconBg={colors.successLight} iconColor={colors.accent}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="cube-outline" label="Products" value={dashboard?.products_count || 0}
              iconBg={colors.warningLight} iconColor={colors.warning}
            />
            <StatCard
              icon="cash-outline" label="Earnings" value={`₦${((dashboard?.total_earnings || 0) / 1000).toFixed(0)}K`}
              iconBg={colors.primaryLight} iconColor={colors.primary}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(seller)/add-product')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Add Product</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={handleShareStore}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Share Store</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(seller)/orders')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {dashboard?.recent_orders?.length > 0 ? (
            dashboard.recent_orders.map((order: any) => {
              const isCompleted = order.status === 'completed';
              const initials = (order.buyer_name || '?')[0].toUpperCase();
              return (
                <View
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.orderAvatar, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.orderAvatarText, { color: colors.primary }]}>{initials}</Text>
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={[styles.orderBuyer, { color: colors.text }]}>{order.buyer_name}</Text>
                    <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={[styles.orderAmount, { color: colors.text }]}>
                      ₦{(order.total_amount || 0).toLocaleString()}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: isCompleted ? colors.successLight : colors.warningLight }]}>
                      <Text style={[styles.statusText, { color: isCompleted ? colors.accent : colors.warning }]}>
                        {order.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No orders yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>Share your store link to start selling!</Text>
            </View>
          )}
        </View>

        {isSubscribed && (
          <View style={[styles.activeIndicator, { backgroundColor: colors.successLight, borderColor: colors.accent }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
            <Text style={[styles.activeText, { color: colors.accent }]}>
              Store active · expires {dashboard?.subscription_end_date ? new Date(dashboard.subscription_end_date).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  storeAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  storeAvatarText: { fontSize: 20, fontWeight: '800' },
  greeting: { fontSize: 12, marginBottom: 2 },
  storeName: { fontSize: 17, fontWeight: '700', maxWidth: 200 },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  subBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  subBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },

  balanceCard: {
    margin: 16, borderRadius: 16, padding: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  balanceLabel: { fontSize: 13, marginBottom: 6 },
  balanceAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  balanceHidden: { fontSize: 32, fontWeight: '800' },
  balanceActions: { flexDirection: 'row', gap: 10 },
  balanceAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  balanceActionText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  statsGrid: { paddingHorizontal: 16, gap: 8, marginTop: 0 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, padding: 16,
    borderRadius: 14, borderWidth: 1,
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  statLabel: { fontSize: 12, marginTop: 3 },

  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 12,
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1,
  },
  orderAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  orderAvatarText: { fontWeight: '700', fontSize: 16 },
  orderInfo: { flex: 1 },
  orderBuyer: { fontSize: 14, fontWeight: '600' },
  orderDate: { fontSize: 12, marginTop: 2 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderAmount: { fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

  emptyState: {
    alignItems: 'center', padding: 36, borderRadius: 16, borderWidth: 1,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptySubtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },

  activeIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  activeText: { fontSize: 13, fontWeight: '500' },
});
