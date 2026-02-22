import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function Wallet() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<any[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountVerifyError, setAccountVerifyError] = useState('');

  const fetchWallet = async () => {
    try {
      const country = user?.country || 'NG';
      const [walletData, banksData] = await Promise.all([
        api.getWallet(),
        api.getBanks(country),
      ]);
      setWallet(walletData);
      setBanks(banksData);
      setFilteredBanks(banksData);
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('store not found') || msg.includes('404')) {
        // Store doesn't exist yet, wallet will show empty
        setWallet({ wallet_balance: 0, pending_balance: 0, total_earnings: 0 });
      }
      console.log('Wallet error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWallet();
  }, []);

  // Filter banks when search text changes
  useEffect(() => {
    if (!bankSearch.trim()) {
      setFilteredBanks(banks);
    } else {
      const q = bankSearch.toLowerCase();
      setFilteredBanks(banks.filter((b) => b.name.toLowerCase().includes(q)));
    }
  }, [bankSearch, banks]);

  // Auto-verify account when 10 digits entered and bank selected
  useEffect(() => {
    if (selectedBank && accountNumber.length === 10) {
      verifyAccount();
    } else {
      setAccountName('');
      setAccountVerifyError('');
    }
  }, [selectedBank, accountNumber]);

  const verifyAccount = async () => {
    setVerifyingAccount(true);
    setAccountName('');
    setAccountVerifyError('');
    try {
      const result = await api.verifyAccount(selectedBank.code, accountNumber);
      setAccountName(result.account_name);
    } catch (error: any) {
      setAccountVerifyError('Could not verify account. Check details and try again.');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleSetupBank = async () => {
    if (!selectedBank || !accountNumber) {
      Alert.alert('Error', 'Please select a bank and enter account number');
      return;
    }
    if (accountNumber.length !== 10) {
      Alert.alert('Error', 'Account number must be exactly 10 digits');
      return;
    }
    if (!accountName) {
      Alert.alert('Error', 'Please wait for account verification to complete');
      return;
    }

    setSubmitting(true);
    try {
      await api.setupBank(selectedBank.code, accountNumber, selectedBank.name);
      Alert.alert('Success', `Bank account linked!\n${accountName}`);
      closeBankModal();
      fetchWallet();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (amount < 100) {
      Alert.alert('Error', 'Minimum withdrawal is ₦100');
      return;
    }
    if (amount > (wallet?.wallet_balance || 0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    setSubmitting(true);
    try {
      await api.withdraw(amount);
      Alert.alert('Success', 'Withdrawal initiated! Funds will be credited to your bank account shortly.');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchWallet();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeBankModal = () => {
    setShowBankModal(false);
    setAccountName('');
    setAccountVerifyError('');
    setAccountNumber('');
    setSelectedBank(null);
    setBankSearch('');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Wallet</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            ₦{(wallet?.wallet_balance || 0).toLocaleString()}
          </Text>
          <TouchableOpacity
            style={[
              styles.withdrawButton,
              !wallet?.bank_account_number && styles.withdrawButtonDisabled,
            ]}
            onPress={() => {
              if (!wallet?.bank_account_number) {
                Alert.alert('Setup Required', 'Please link your bank account first');
              } else {
                setShowWithdrawModal(true);
              }
            }}
          >
            <Text style={[styles.withdrawButtonText, { color: colors.primary }]}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Earnings</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ₦{(wallet?.total_earnings || 0).toLocaleString()}
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ₦{(wallet?.pending_balance || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bank Account</Text>
          {wallet?.bank_account_number ? (
            <View style={[styles.bankCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.bankIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="business-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.bankInfo}>
                <Text style={[styles.bankName, { color: colors.text }]}>{wallet.bank_name}</Text>
                <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
                  ****{wallet.bank_account_number.slice(-4)}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBankButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowBankModal(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={[styles.addBankText, { color: colors.primary }]}>Link Bank Account</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Withdrawal History</Text>
          {wallet?.withdrawals?.length > 0 ? (
            wallet.withdrawals.map((w: any) => (
              <View key={w._id} style={[styles.withdrawalCard, { backgroundColor: colors.surface }]}>
                <View>
                  <Text style={[styles.withdrawalAmount, { color: colors.text }]}>
                    ₦{(w.amount || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.withdrawalDate, { color: colors.textSecondary }]}>
                    {new Date(w.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.withdrawalStatus,
                    { backgroundColor: colors.errorLight },
                    w.status === 'success' && { backgroundColor: colors.successLight },
                    w.status === 'pending' && { backgroundColor: colors.warningLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.withdrawalStatusText,
                      { color: colors.error },
                      w.status === 'success' && { color: colors.success },
                      w.status === 'pending' && { color: colors.warning },
                    ]}
                  >
                    {w.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No withdrawals yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bank Setup Modal */}
      <Modal visible={showBankModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Link Bank Account</Text>
              <TouchableOpacity onPress={closeBankModal}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Select Bank</Text>
            <TouchableOpacity
              style={[styles.bankSelector, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => setShowBankPicker(true)}
            >
              <Text style={[styles.bankSelectorText, { color: selectedBank ? colors.text : colors.textTertiary }]}>
                {selectedBank ? selectedBank.name : 'Tap to select a bank'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Account Number</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              placeholder="Enter 10-digit account number"
              placeholderTextColor={colors.textTertiary}
              value={accountNumber}
              onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            {verifyingAccount && (
              <View style={[styles.statusBox, { backgroundColor: colors.surfaceSecondary }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.statusBoxText, { color: colors.textSecondary }]}>Verifying account...</Text>
              </View>
            )}

            {accountName ? (
              <View style={[styles.statusBox, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.statusBoxText, { color: colors.success }]}>{accountName}</Text>
              </View>
            ) : null}

            {accountVerifyError ? (
              <View style={[styles.statusBox, { backgroundColor: colors.errorLight }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.statusBoxText, { color: colors.error }]}>{accountVerifyError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: colors.primary },
                (submitting || !accountName) && styles.modalButtonDisabled,
              ]}
              onPress={handleSetupBank}
              disabled={submitting || !accountName}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Link Account</Text>
              )}
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bank Picker Modal */}
      <Modal visible={showBankPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.bankPickerContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Bank</Text>
              <TouchableOpacity onPress={() => { setShowBankPicker(false); setBankSearch(''); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="search" size={18} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search banks..."
                placeholderTextColor={colors.textTertiary}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
              {bankSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBankSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.bankListItem,
                    { borderBottomColor: colors.border },
                    selectedBank?.code === item.code && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => {
                    setSelectedBank(item);
                    setShowBankPicker(false);
                    setBankSearch('');
                  }}
                >
                  <Text style={[styles.bankListItemText, { color: colors.text }]}>{item.name}</Text>
                  {selectedBank?.code === item.code && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.noBanksContainer}>
                  <Text style={[styles.noBanksText, { color: colors.textSecondary }]}>
                    {banks.length === 0
                      ? 'Could not load banks. Pull to refresh.'
                      : 'No banks match your search.'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Withdraw Funds</Text>
              <TouchableOpacity onPress={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.availableBalance, { color: colors.textSecondary }]}>
              Available: ₦{(wallet?.wallet_balance || 0).toLocaleString()}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Amount (₦)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              placeholder="Enter amount (min ₦100)"
              placeholderTextColor={colors.textTertiary}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <View style={[styles.withdrawInfoBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.withdrawInfoText, { color: colors.textSecondary }]}>
                Funds will be sent to your linked bank account:
              </Text>
              <Text style={[styles.withdrawBankInfo, { color: colors.text }]}>
                {wallet?.bank_name} — ****{wallet?.bank_account_number?.slice(-4)}
              </Text>
              <Text style={[styles.withdrawNote, { color: colors.textTertiary }]}>Minimum withdrawal: ₦100</Text>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }, submitting && styles.modalButtonDisabled]}
              onPress={handleWithdraw}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Withdraw</Text>
              )}
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  scrollView: { flex: 1, padding: 16 },
  balanceCard: { borderRadius: 16, padding: 24, alignItems: 'center' },
  balanceLabel: { color: '#C7D2FE', fontSize: 14 },
  balanceAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  withdrawButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  withdrawButtonDisabled: { opacity: 0.7 },
  withdrawButtonText: { fontWeight: '600', fontSize: 16 },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  statBox: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  bankCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 16 },
  bankIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bankInfo: { flex: 1, marginLeft: 12 },
  bankName: { fontSize: 16, fontWeight: '600' },
  accountNumber: { fontSize: 14, marginTop: 2 },
  addBankButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 20, borderWidth: 2, borderStyle: 'dashed' },
  addBankText: { fontWeight: '600', marginLeft: 8 },
  withdrawalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 16, marginBottom: 8 },
  withdrawalAmount: { fontSize: 16, fontWeight: '600' },
  withdrawalDate: { fontSize: 12, marginTop: 2 },
  withdrawalStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  withdrawalStatusText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', padding: 24, borderRadius: 12 },
  emptyText: {},
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  bankPickerContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, height: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  bankSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  bankSelectorText: { fontSize: 16, flex: 1 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  bankListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
  bankListItemText: { fontSize: 15, flex: 1 },
  noBanksContainer: { alignItems: 'center', paddingTop: 32 },
  noBanksText: { fontSize: 14, textAlign: 'center' },
  modalInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  statusBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
  statusBoxText: { fontWeight: '600', flex: 1 },
  availableBalance: { fontSize: 14, marginBottom: 16 },
  withdrawInfoBox: { padding: 12, borderRadius: 8, marginBottom: 16 },
  withdrawInfoText: { fontSize: 13, marginBottom: 4 },
  withdrawBankInfo: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  withdrawNote: { fontSize: 12, marginTop: 2 },
  modalButton: { borderRadius: 12, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
});
