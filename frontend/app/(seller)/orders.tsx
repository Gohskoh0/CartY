import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';

const FILTERS = ['All', 'Pending', 'Completed'] as const;
type Filter = typeof FILTERS[number];

export default function Orders() {
  const { colors } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchOrders = async () => {
    try { setOrders(await api.getOrders()); }
    catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchOrders(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchOrders(); }, []);

  const filtered = orders.filter(o => {
    if (filter === 'All') return true;
    return o.status === filter.toLowerCase();
  });

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Orders</Text>
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{orders.length}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? colors.primary : colors.textSecondary }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={o => o.id || o._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No orders yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Orders will appear here when customers buy from your store</Text>
          </View>
        }
        renderItem={({ item: order }) => {
          const id = order.id || order._id;
          const isCompleted = order.status === 'completed';
          const isOpen = expanded === id;
          const initials = (order.buyer_name || '?')[0].toUpperCase();

          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setExpanded(isOpen ? null : id)}
              activeOpacity={0.85}
            >
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
                </View>
                <View style={styles.cardMain}>
                  <View style={styles.cardRow}>
                    <Text style={[styles.buyerName, { color: colors.text }]}>{order.buyer_name}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: isCompleted ? colors.successLight : colors.warningLight }]}>
                      <Text style={[styles.statusText, { color: isCompleted ? colors.accent : colors.warning }]}>
                        {order.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardRow}>
                    <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.amount, { color: colors.text }]}>₦{(order.total_amount || 0).toLocaleString()}</Text>
                  </View>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
              </View>

              {/* Expanded details */}
              {isOpen && (
                <View style={[styles.details, { borderTopColor: colors.border }]}>
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{order.buyer_phone}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{order.buyer_address}</Text>
                  </View>
                  {order.buyer_note ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>{order.buyer_note}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.itemsDivider, { borderTopColor: colors.border }]} />
                  {order.items?.map((item: any, i: number) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{item.name} ×{item.quantity}</Text>
                      <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>₦{(item.price || 0).toLocaleString()}</Text>
                    </View>
                  ))}
                  <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
                    <Text style={[styles.totalAmount, { color: colors.primary }]}>₦{(order.total_amount || 0).toLocaleString()}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  filterTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  filterText: { fontSize: 14, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 17 },
  cardMain: { flex: 1, gap: 4 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buyerName: { fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  orderDate: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '700' },
  details: { padding: 14, paddingTop: 12, borderTopWidth: 1, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailText: { fontSize: 13, flex: 1 },
  itemsDivider: { borderTopWidth: 1, marginVertical: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 13 },
  itemPrice: { fontSize: 13 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTopWidth: 1 },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalAmount: { fontSize: 16, fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
