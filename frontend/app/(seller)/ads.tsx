import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:      { label: 'Draft',      color: '#94A3B8', bg: '#1F2A3C' },
  launching:  { label: 'Launching',  color: '#6366F1', bg: '#1E1D3A' },
  active:     { label: 'Active',     color: '#10B981', bg: '#1A2D27' },
  completed:  { label: 'Done',       color: '#94A3B8', bg: '#1F2A3C' },
  failed:     { label: 'Failed',     color: '#F87171', bg: '#2D1A1A' },
};

const PLATFORM_CONFIG: Record<string, { name: string; sub: string; icon: string; color: string }> = {
  meta:   { name: 'Meta',   sub: 'Facebook & Instagram',  icon: 'logo-facebook', color: '#1877F2' },
  tiktok: { name: 'TikTok', sub: 'TikTok Feed & Stories', icon: 'musical-notes', color: '#FF0050' },
};

const CONNECT_HELP: Record<string, { tokenLabel: string; idLabel: string; idPlaceholder: string; instructions: string }> = {
  meta: {
    tokenLabel: 'Meta Access Token',
    idLabel: 'Ad Account ID',
    idPlaceholder: 'act_123456789',
    instructions: '1. Go to Meta Business Manager\n2. Navigate to Business Settings → System Users\n3. Create a System User with "Advertiser" role\n4. Generate an access token with ads_management permission\n5. Copy your Ad Account ID from Ads Manager (starts with "act_")',
  },
  tiktok: {
    tokenLabel: 'TikTok Access Token',
    idLabel: 'Advertiser ID',
    idPlaceholder: '7123456789012345678',
    instructions: '1. Go to TikTok Ads Manager\n2. Navigate to Tools → API\n3. Generate a long-term access token\n4. Find your Advertiser ID in the account settings',
  },
};

export default function Ads() {
  const router = useRouter();
  const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [connected, setConnected] = useState<any>({ meta: { connected: false }, tiktok: { connected: false } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Connect modal state
  const [modal, setModal] = useState<{ visible: boolean; platform: 'meta' | 'tiktok' | null }>({ visible: false, platform: null });
  const [accessToken, setAccessToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const fetchAll = async () => {
    try {
      const [camps, accts] = await Promise.all([
        api.getAdCampaigns(),
        api.getConnectedAdAccounts(),
      ]);
      setCampaigns(Array.isArray(camps) ? camps : []);
      setConnected(accts);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, []);

  const openConnectModal = (platform: 'meta' | 'tiktok') => {
    setAccessToken('');
    setAccountId('');
    setShowInstructions(false);
    setModal({ visible: true, platform });
  };

  const handleConnect = async () => {
    if (!modal.platform || !accessToken.trim() || !accountId.trim()) {
      Alert.alert('Required', 'Please enter both the access token and account ID.');
      return;
    }
    setConnecting(true);
    try {
      if (modal.platform === 'meta') {
        await api.connectMetaAccount({ access_token: accessToken.trim(), ad_account_id: accountId.trim() });
      } else {
        await api.connectTikTokAccount({ access_token: accessToken.trim(), advertiser_id: accountId.trim() });
      }
      setModal({ visible: false, platform: null });
      await fetchAll();
      Alert.alert('Connected!', `Your ${modal.platform === 'meta' ? 'Meta' : 'TikTok'} Ads account is now connected.`);
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message || 'Could not validate your credentials. Please check them and try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = (platform: 'meta' | 'tiktok') => {
    const name = platform === 'meta' ? 'Meta' : 'TikTok';
    Alert.alert(`Disconnect ${name}`, `Remove your ${name} Ads account connection? Existing campaigns will not be affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            if (platform === 'meta') await api.disconnectMetaAccount();
            else await api.disconnectTikTokAccount();
            await fetchAll();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const renderPlatformCard = (platform: 'meta' | 'tiktok') => {
    const cfg = PLATFORM_CONFIG[platform];
    const acct = connected[platform];
    const isConnected = acct?.connected;
    const accountIdLabel = platform === 'meta' ? acct?.ad_account_id : acct?.advertiser_id;

    return (
      <View key={platform} style={[styles.platformCard, { backgroundColor: colors.surface, borderColor: isConnected ? cfg.color + '55' : colors.border }]}>
        <View style={[styles.platformIcon, { backgroundColor: cfg.color + '22' }]}>
          <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.platformName, { color: colors.text }]}>{cfg.name}</Text>
          <Text style={[styles.platformSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {isConnected ? accountIdLabel || 'Connected' : cfg.sub}
          </Text>
        </View>
        {isConnected ? (
          <TouchableOpacity onPress={() => handleDisconnect(platform)} style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={15} color="#10B981" />
            <Text style={styles.connectedText}>Connected</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.connectBtn, { backgroundColor: cfg.color }]} onPress={() => openConnectModal(platform)}>
            <Text style={styles.connectBtnText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCampaign = ({ item }: { item: any }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
    const platform = PLATFORM_CONFIG[item.platform] || PLATFORM_CONFIG.meta;
    const ctr = item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(1) : '0.0';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.platformBadge, { backgroundColor: platform.color + '22' }]}>
            <Ionicons name={platform.icon as any} size={16} color={platform.color} />
            <Text style={[styles.platformBadgeText, { color: platform.color }]}>{platform.name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={[styles.headline, { color: colors.text }]} numberOfLines={1}>
          {item.ad_headline || 'Untitled Campaign'}
        </Text>
        <Text style={[styles.objective, { color: colors.textSecondary }]}>
          {item.objective?.charAt(0).toUpperCase() + item.objective?.slice(1)} · {item.target_gender === 'all' ? 'All genders' : item.target_gender}
        </Text>
        <View style={[styles.metricsRow, { borderTopColor: colors.border }]}>
          <MetricItem label="Budget" value={`₦${(item.budget_ngn || 0).toLocaleString()}`} colors={colors} />
          <MetricItem label="Reach" value={(item.reach || 0).toLocaleString()} colors={colors} />
          <MetricItem label="Clicks" value={(item.clicks || 0).toLocaleString()} colors={colors} />
          <MetricItem label="CTR" value={`${ctr}%`} colors={colors} highlight={parseFloat(ctr) > 1} />
        </View>
      </View>
    );
  };

  const hasAnyConnected = connected.meta?.connected || connected.tiktok?.connected;

  const help = modal.platform ? CONNECT_HELP[modal.platform] : null;
  const platformCfg = modal.platform ? PLATFORM_CONFIG[modal.platform] : null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Ads</Text>
        {hasAnyConnected && (
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(seller)/create-ad')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={campaigns}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        renderItem={renderCampaign}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {/* Connected Accounts */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ad Accounts</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Connect your accounts to run ads directly from your ad budget.
              </Text>
              <View style={{ gap: 10, marginTop: 12 }}>
                {renderPlatformCard('meta')}
                {renderPlatformCard('tiktok')}
              </View>
            </View>

            {/* Campaigns header */}
            {campaigns.length > 0 && (
              <Text style={[styles.campaignsLabel, { color: colors.textSecondary }]}>
                YOUR CAMPAIGNS
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          hasAnyConnected ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="megaphone-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Campaigns Yet</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Create your first campaign to start reaching more customers.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(seller)/create-ad')}
              >
                <Ionicons name="rocket-outline" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Create Campaign</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptySub, { color: colors.textSecondary, textAlign: 'center' }]}>
                Connect a Meta or TikTok account above to start running ads.
              </Text>
            </View>
          )
        }
      />

      {/* Connect Modal */}
      <Modal visible={modal.visible} animationType="slide" transparent onRequestClose={() => setModal({ visible: false, platform: null })}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHandle} />

              {/* Modal header */}
              <View style={styles.modalHeader}>
                {platformCfg && (
                  <View style={[styles.modalIcon, { backgroundColor: platformCfg.color + '22' }]}>
                    <Ionicons name={platformCfg.icon as any} size={24} color={platformCfg.color} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Connect {platformCfg?.name}
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                    Enter your {platformCfg?.name} Ads credentials
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setModal({ visible: false, platform: null })}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Instructions toggle */}
                <TouchableOpacity
                  style={[styles.instructionsToggle, { borderColor: colors.border }]}
                  onPress={() => setShowInstructions(v => !v)}
                >
                  <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
                  <Text style={[styles.instructionsToggleText, { color: colors.primary }]}>
                    How to get your credentials
                  </Text>
                  <Ionicons name={showInstructions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
                </TouchableOpacity>

                {showInstructions && help && (
                  <View style={[styles.instructionsBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>{help.instructions}</Text>
                  </View>
                )}

                {/* Access Token */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {help?.tokenLabel ?? 'Access Token'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={accessToken}
                  onChangeText={setAccessToken}
                  placeholder="Paste access token..."
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  numberOfLines={3}
                />

                {/* Account / Advertiser ID */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {help?.idLabel ?? 'Account ID'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={accountId}
                  onChangeText={setAccountId}
                  placeholder={help?.idPlaceholder ?? 'Enter account ID'}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={[styles.connectModalBtn, { backgroundColor: platformCfg?.color ?? colors.primary, opacity: connecting ? 0.7 : 1 }]}
                  onPress={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="link-outline" size={18} color="#fff" />
                      <Text style={styles.connectModalBtnText}>Connect Account</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 32 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  list: { padding: 16, gap: 12, paddingBottom: 120 },
  // Section
  section: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSub: { fontSize: 13, marginTop: 2 },
  campaignsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingLeft: 4 },
  // Platform card
  platformCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 12, borderWidth: 1,
  },
  platformIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  platformName: { fontSize: 14, fontWeight: '700' },
  platformSub: { fontSize: 12 },
  connectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#10B98122' },
  connectedText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  connectBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Campaign card
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  platformBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  platformBadgeText: { fontSize: 13, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headline: { fontSize: 16, fontWeight: '700' },
  objective: { fontSize: 12 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: { fontSize: 15, fontWeight: '800' },
  metricLabel: { fontSize: 10, marginTop: 2, fontWeight: '500' },
  // Empty
  empty: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  emptyIconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { fontSize: 14, lineHeight: 21 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#4B5563', alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSub: { fontSize: 13, marginTop: 2 },
  instructionsToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12,
  },
  instructionsToggleText: { flex: 1, fontSize: 14, fontWeight: '600' },
  instructionsBox: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 16 },
  instructionsText: { fontSize: 13, lineHeight: 22 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  input: {
    borderRadius: 12, borderWidth: 1, padding: 14,
    fontSize: 14, marginBottom: 16,
  },
  connectModalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14, marginTop: 4,
  },
  connectModalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
