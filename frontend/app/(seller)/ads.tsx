import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Draft',     color: '#94A3B8', bg: '#1F2A3C' },
  paid:       { label: 'Paid',      color: '#FBBF24', bg: '#2D2A1A' },
  launching:  { label: 'Launching', color: '#6366F1', bg: '#1E1D3A' },
  active:     { label: 'Active',    color: '#10B981', bg: '#1A2D27' },
  completed:  { label: 'Done',      color: '#94A3B8', bg: '#1F2A3C' },
  failed:     { label: 'Failed',    color: '#F87171', bg: '#2D1A1A' },
};

const PLATFORM_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  meta:   { name: 'Meta',   icon: 'logo-facebook', color: '#1877F2' },
  tiktok: { name: 'TikTok', icon: 'musical-notes', color: '#FF0050' },
};

export default function Ads() {
  const router = useRouter();
  const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const data = await api.getAdCampaigns();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCampaigns();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderCampaign = ({ item }: { item: any }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const platform = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.meta;
    const ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(1) : '0.0';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {}}
        activeOpacity={0.8}
      >
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={[styles.platformBadge, { backgroundColor: platform.color + '22' }]}>
            <Ionicons name={platform.icon as any} size={18} color={platform.color} />
            <Text style={[styles.platformText, { color: platform.color }]}>{platform.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: colors.text }]} numberOfLines={1}>
          {item.ad_headline || 'Untitled Campaign'}
        </Text>
        <Text style={[styles.objective, { color: colors.textSecondary }]}>
          {item.objective?.charAt(0).toUpperCase() + item.objective?.slice(1)} · {item.target_gender === 'all' ? 'All genders' : item.target_gender}
        </Text>

        {/* Metrics row */}
        <View style={[styles.metricsRow, { borderTopColor: colors.border }]}>
          <MetricItem label="Budget" value={`₦${(item.budget_ngn || 0).toLocaleString()}`} colors={colors} />
          <MetricItem label="Reach" value={(item.reach || 0).toLocaleString()} colors={colors} />
          <MetricItem label="Clicks" value={(item.clicks || 0).toLocaleString()} colors={colors} />
          <MetricItem label="CTR" value={`${ctr}%`} colors={colors} highlight={parseFloat(ctr) > 1} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Ads</Text>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(seller)/create-ad')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {campaigns.length > 0 ? (
        <FlatList
          data={campaigns}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={renderCampaign}
          ListHeaderComponent={
            <View style={[styles.infoBar, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoBarText, { color: colors.primary }]}>
                CartY runs your ads on Meta & TikTok. Analytics update daily.
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.empty}>
          {/* Hero illustration */}
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="megaphone-outline" size={56} color={colors.primary} />
          </View>

          <Text style={[styles.emptyTitle, { color: colors.text }]}>Boost Your Sales</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Run Meta & TikTok ads managed by CartY. We handle the campaign — you get the customers.
          </Text>

          {/* Feature chips */}
          <View style={styles.chips}>
            {['Meta & TikTok', 'Live Analytics', 'CartY Managed', '15% Service Fee'].map(chip => (
              <View key={chip} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>{chip}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(seller)/create-ad')}
          >
            <Ionicons name="rocket-outline" size={20} color="#fff" />
            <Text style={styles.emptyBtnText}>Create First Campaign</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function MetricItem({ label, value, colors, highlight = false }: any) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: highlight ? colors.accent : colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontWeight: '800' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, gap: 12 },
  infoBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4,
  },
  infoBarText: { flex: 1, fontSize: 12, lineHeight: 18 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  platformBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  platformText: { fontSize: 13, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headline: { fontSize: 16, fontWeight: '700' },
  objective: { fontSize: 12 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: 15, fontWeight: '800' },
  metricLabel: { fontSize: 10, marginTop: 2, fontWeight: '500' },
  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  emptyIconCircle: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '500' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
