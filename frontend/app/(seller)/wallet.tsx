import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

const PIN_KEY = '@carty_wallet_pin';

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
  const [banksLoading, setBanksLoading] = useState(false);

  // Custom alert/confirm modals
  const [alertModal, setAlertModal] = useState<{
    visible: boolean; type: 'success' | 'error' | 'info'; title: string; message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean; title: string; message: string;
    confirmText: string; isDestructive: boolean; onConfirm: () => void;
  }>({ visible: false, title: '', message: '', confirmText: 'OK', isDestructive: false, onConfirm: () => {} });

  const showAlert = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    setAlertModal({ visible: true, type, title, message });
  };
  const showConfirm = (title: string, message: string, confirmText: string, isDestructive: boolean, onConfirm: () => void) => {
    setConfirmModal({ visible: true, title, message, confirmText, isDestructive, onConfirm });
  };

  // Inline validation errors for modals (avoids Android dual-modal issue)
  const [withdrawError, setWithdrawError] = useState('');
  const [transferError, setTransferError] = useState('');

  // Transfer state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferBank, setTransferBank] = useState<any>(null);
  const [transferAccountNumber, setTransferAccountNumber] = useState('');
  const [transferAccountName, setTransferAccountName] = useState('');
  const [transferVerifying, setTransferVerifying] = useState(false);
  const [transferVerifyError, setTransferVerifyError] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  // which modal the bank picker should return to: 'setup' | 'transfer'
  const [pickerContext, setPickerContext] = useState<'setup' | 'transfer'>('setup');

  // PIN security
  const [pinExists, setPinExists] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinDigits, setPinDigits] = useState('');
  const [pinStep, setPinStep] = useState<'verify' | 'create' | 'confirm_create'>('verify');
  const [pinFirstEntry, setPinFirstEntry] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinParent, setPinParent] = useState<'withdraw' | 'transfer'>('withdraw');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const fetchBanks = async (country: string) => {
    setBanksLoading(true);
    try {
      const banksData = await api.getBanks(country);
      const list = Array.isArray(banksData) ? banksData : [];
      setBanks(list);
      setFilteredBanks(list);
    } catch (error) {
      console.log('Banks fetch error:', error);
    } finally {
      setBanksLoading(false);
    }
  };

  const fetchWallet = async () => {
    try {
      const walletData = await api.getWallet();
      setWallet(walletData);
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('store not found') || msg.includes('404')) {
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
    AsyncStorage.getItem(PIN_KEY).then(p => setPinExists(!!p));
  }, []);

  useEffect(() => {
    const country = user?.country || 'NG';
    fetchBanks(country);
  }, [user?.country]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const country = user?.country || 'NG';
    fetchWallet();
    fetchBanks(country);
  }, [user?.country]);

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
      setAccountVerifyError(error?.message || 'Could not verify account. Check details and try again.');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleSetupBank = async () => {
    if (!selectedBank || !accountNumber) {
      showAlert('error', 'Missing Details', 'Please select a bank and enter account number');
      return;
    }
    if (accountNumber.length !== 10) {
      showAlert('error', 'Invalid Account', 'Account number must be exactly 10 digits');
      return;
    }
    if (!accountName) {
      showAlert('info', 'Please Wait', 'Account is still being verified. Try again in a moment.');
      return;
    }

    setSubmitting(true);
    try {
      await api.setupBank(selectedBank.code, accountNumber, selectedBank.name);
      closeBankModal();
      showAlert('success', 'Bank Linked!', `${accountName} has been linked to your wallet.`);
      fetchWallet();
    } catch (error: any) {
      showAlert('error', 'Link Failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Please enter a valid amount.');
      return;
    }
    if (amount < 100) {
      setWithdrawError('Minimum withdrawal is ₦100.');
      return;
    }
    if (amount > (wallet?.wallet_balance || 0)) {
      setWithdrawError(`Insufficient balance. Available: ₦${(wallet?.wallet_balance || 0).toLocaleString()}`);
      return;
    }
    setWithdrawError('');

    openPinModal('withdraw', async () => {
      setSubmitting(true);
      try {
        await api.withdraw(amount);
        setWithdrawAmount('');
        fetchWallet();
        showAlert('success', 'Withdrawal Initiated', 'Funds will be credited to your bank account shortly.');
      } catch (error: any) {
        showAlert('error', 'Withdrawal Failed', error.message);
      } finally {
        setSubmitting(false);
      }
    });
  };

  const closeBankModal = () => {
    setShowBankModal(false);
    setAccountName('');
    setAccountVerifyError('');
    setAccountNumber('');
    setSelectedBank(null);
    setBankSearch('');
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setTransferBank(null);
    setTransferAccountNumber('');
    setTransferAccountName('');
    setTransferVerifyError('');
    setTransferAmount('');
    setTransferError('');
  };

  // ---- PIN helpers ----
  const openPinModal = (parent: 'withdraw' | 'transfer', action: () => void) => {
    setPinParent(parent);
    setPendingAction(() => action);
    setPinDigits('');
    setPinError('');
    setPinAttempts(0);
    // close the parent modal before opening PIN (avoids Android dual-modal issue)
    if (parent === 'withdraw') setShowWithdrawModal(false);
    else setShowTransferModal(false);
    setPinStep(pinExists ? 'verify' : 'create');
    setTimeout(() => setShowPinModal(true), 300);
  };

  const closePinModal = () => {
    setShowPinModal(false);
    setPinDigits('');
    setPinError('');
    setPendingAction(null);
    // reopen the parent modal so user can retry
    setTimeout(() => {
      if (pinParent === 'withdraw') setShowWithdrawModal(true);
      else setShowTransferModal(true);
    }, 300);
  };

  const handlePinKey = (key: string) => {
    if (key === '⌫') {
      setPinDigits(d => d.slice(0, -1));
      setPinError('');
      return;
    }
    if (pinDigits.length >= 4) return;
    const next = pinDigits + key;
    setPinDigits(next);
    if (next.length === 4) setTimeout(() => handlePinSubmit(next), 150);
  };

  const handlePinSubmit = async (digits: string) => {
    if (pinStep === 'create') {
      setPinFirstEntry(digits);
      setPinDigits('');
      setPinStep('confirm_create');
    } else if (pinStep === 'confirm_create') {
      if (digits === pinFirstEntry) {
        await AsyncStorage.setItem(PIN_KEY, digits);
        setPinExists(true);
        setPinFirstEntry('');
        setShowPinModal(false);
        setPinDigits('');
        pendingAction?.();
        setPendingAction(null);
      } else {
        setPinError('PINs do not match. Try again.');
        setPinDigits('');
        setPinStep('create');
        setPinFirstEntry('');
      }
    } else {
      const stored = await AsyncStorage.getItem(PIN_KEY);
      if (digits === stored) {
        setShowPinModal(false);
        setPinDigits('');
        setPinError('');
        setPinAttempts(0);
        pendingAction?.();
        setPendingAction(null);
      } else {
        const attempts = pinAttempts + 1;
        setPinAttempts(attempts);
        setPinDigits('');
        if (attempts >= 5) {
          setPinError('Too many attempts. Try again in 30 seconds.');
          setTimeout(() => { setPinAttempts(0); setPinError(''); }, 30000);
        } else {
          setPinError(`Incorrect PIN. ${5 - attempts} attempt${5 - attempts !== 1 ? 's' : ''} remaining.`);
        }
      }
    }
  };
  // ---- end PIN helpers ----

  // Auto-verify transfer account when 10 digits entered and bank selected
  useEffect(() => {
    if (transferBank && transferAccountNumber.length === 10) {
      verifyTransferAccount();
    } else {
      setTransferAccountName('');
      setTransferVerifyError('');
    }
  }, [transferBank, transferAccountNumber]);

  const verifyTransferAccount = async () => {
    setTransferVerifying(true);
    setTransferAccountName('');
    setTransferVerifyError('');
    try {
      const result = await api.verifyAccount(transferBank.code, transferAccountNumber);
      setTransferAccountName(result.account_name);
    } catch (error: any) {
      setTransferVerifyError(error?.message || 'Could not verify account. Check details and try again.');
    } finally {
      setTransferVerifying(false);
    }
  };

  const handleUnlinkBank = () => {
    showConfirm(
      'Unlink Bank Account',
      `Remove ${wallet?.bank_name} (****${wallet?.bank_account_number?.slice(-4)}) from your wallet?`,
      'Unlink',
      true,
      async () => {
        try {
          await api.unlinkBank();
          fetchWallet();
          showAlert('success', 'Bank Unlinked', 'Your bank account has been removed.');
        } catch (error: any) {
          showAlert('error', 'Failed', error.message);
        }
      }
    );
  };

  const handleTransfer = async () => {
    if (!transferBank || !transferAccountNumber || !transferAccountName) {
      setTransferError('Please select a bank and verify the account number first.');
      return;
    }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount < 100) {
      setTransferError('Minimum transfer is ₦100.');
      return;
    }
    if (amount > (wallet?.wallet_balance || 0)) {
      setTransferError(`Insufficient balance. Available: ₦${(wallet?.wallet_balance || 0).toLocaleString()}`);
      return;
    }
    setTransferError('');

    openPinModal('transfer', async () => {
      setSubmitting(true);
      try {
        await api.transferToBank(transferBank.code, transferAccountNumber, transferBank.name, amount);
        closeTransferModal();
        fetchWallet();
        showAlert('success', 'Transfer Successful!', `₦${amount.toLocaleString()} sent to ${transferAccountName}.`);
      } catch (error: any) {
        showAlert('error', 'Transfer Failed', error.message);
      } finally {
        setSubmitting(false);
      }
    });
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
          <View style={styles.balanceButtons}>
            <TouchableOpacity
              style={[styles.withdrawButton, !wallet?.bank_account_number && styles.withdrawButtonDisabled]}
              onPress={() => {
                if (!wallet?.bank_account_number) {
                  showAlert('info', 'Setup Required', 'Please link your bank account first before withdrawing.');
                } else {
                  setShowWithdrawModal(true);
                }
              }}
            >
              <Text style={[styles.withdrawButtonText, { color: colors.primary }]}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.transferButton}
              onPress={() => setShowTransferModal(true)}
            >
              <Text style={[styles.withdrawButtonText, { color: colors.primary }]}>Transfer</Text>
            </TouchableOpacity>
          </View>
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
                  {wallet.bank_account_name ? `${wallet.bank_account_name} · ` : ''}****{wallet.bank_account_number.slice(-4)}
                </Text>
              </View>
              <TouchableOpacity onPress={handleUnlinkBank} style={styles.unlinkButton}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
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
              <View key={w.id} style={[styles.withdrawalCard, { backgroundColor: colors.surface }]}>
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
              onPress={() => {
                if (banks.length === 0 && !banksLoading) {
                  fetchBanks(user?.country || 'NG');
                }
                setPickerContext('setup');
                setShowBankModal(false);
                setTimeout(() => setShowBankPicker(true), 300);
              }}
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
              <TouchableOpacity onPress={() => {
                setShowBankPicker(false);
                setBankSearch('');
                setTimeout(() => {
                  if (pickerContext === 'transfer') setShowTransferModal(true);
                  else setShowBankModal(true);
                }, 300);
              }}>
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

            {banksLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[{ color: colors.textSecondary, marginTop: 12 }]}>Loading banks...</Text>
              </View>
            )}

            {!banksLoading && <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.id?.toString() || item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.bankListItem,
                    { borderBottomColor: colors.border },
                    selectedBank?.code === item.code && { backgroundColor: colors.primaryLight },
                  ]}
                  onPress={() => {
                    if (pickerContext === 'transfer') {
                      setTransferBank(item);
                    } else {
                      setSelectedBank(item);
                    }
                    setShowBankPicker(false);
                    setBankSearch('');
                    setTimeout(() => {
                      if (pickerContext === 'transfer') setShowTransferModal(true);
                      else setShowBankModal(true);
                    }, 300);
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
            />}
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
              <TouchableOpacity onPress={() => { setShowWithdrawModal(false); setWithdrawAmount(''); setWithdrawError(''); }}>
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

            {withdrawError ? (
              <View style={[styles.statusBox, { backgroundColor: colors.errorLight, marginBottom: 4 }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.statusBoxText, { color: colors.error }]}>{withdrawError}</Text>
              </View>
            ) : null}

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

      {/* Transfer Modal */}
      <Modal visible={showTransferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Transfer Funds</Text>
              <TouchableOpacity onPress={closeTransferModal}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.availableBalance, { color: colors.textSecondary }]}>
              Available: ₦{(wallet?.wallet_balance || 0).toLocaleString()}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Select Bank</Text>
            <TouchableOpacity
              style={[styles.bankSelector, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              onPress={() => {
                if (banks.length === 0 && !banksLoading) fetchBanks(user?.country || 'NG');
                setPickerContext('transfer');
                setShowTransferModal(false);
                setTimeout(() => setShowBankPicker(true), 300);
              }}
            >
              <Text style={[styles.bankSelectorText, { color: transferBank ? colors.text : colors.textTertiary }]}>
                {transferBank ? transferBank.name : 'Tap to select a bank'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Account Number</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              placeholder="Enter 10-digit account number"
              placeholderTextColor={colors.textTertiary}
              value={transferAccountNumber}
              onChangeText={(t) => setTransferAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            {transferVerifying && (
              <View style={[styles.statusBox, { backgroundColor: colors.surfaceSecondary }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.statusBoxText, { color: colors.textSecondary }]}>Verifying account...</Text>
              </View>
            )}
            {transferAccountName ? (
              <View style={[styles.statusBox, { backgroundColor: colors.successLight }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.statusBoxText, { color: colors.success }]}>{transferAccountName}</Text>
              </View>
            ) : null}
            {transferVerifyError ? (
              <View style={[styles.statusBox, { backgroundColor: colors.errorLight }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.statusBoxText, { color: colors.error }]}>{transferVerifyError}</Text>
              </View>
            ) : null}

            <Text style={[styles.inputLabel, { color: colors.text }]}>Amount (₦)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              placeholder="Enter amount (min ₦100)"
              placeholderTextColor={colors.textTertiary}
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            {transferError ? (
              <View style={[styles.statusBox, { backgroundColor: colors.errorLight, marginBottom: 4 }]}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={[styles.statusBoxText, { color: colors.error }]}>{transferError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: colors.primary },
                (submitting || !transferAccountName || !transferAmount) && styles.modalButtonDisabled,
              ]}
              onPress={handleTransfer}
              disabled={submitting || !transferAccountName || !transferAmount}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Send Money</Text>
              )}
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={styles.pinOverlay}>
          <View style={[styles.pinBox, { backgroundColor: colors.surface }]}>
            <View style={[styles.pinIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="lock-closed" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.pinTitle, { color: colors.text }]}>
              {pinStep === 'create' ? 'Create Wallet PIN' : pinStep === 'confirm_create' ? 'Confirm PIN' : 'Enter Wallet PIN'}
            </Text>
            <Text style={[styles.pinSubtitle, { color: colors.textSecondary }]}>
              {pinStep === 'create'
                ? 'Set a 4-digit PIN to secure your transactions'
                : pinStep === 'confirm_create'
                ? 'Re-enter your PIN to confirm'
                : pinParent === 'withdraw' ? 'Authorise withdrawal' : 'Authorise transfer'}
            </Text>

            {/* 4 dot indicators */}
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    { borderColor: colors.primary },
                    pinDigits.length > i && { backgroundColor: colors.primary },
                  ]}
                />
              ))}
            </View>

            {pinError ? (
              <Text style={[styles.pinError, { color: colors.error }]}>{pinError}</Text>
            ) : <View style={{ height: 20 }} />}

            {/* Number pad */}
            <View style={styles.numpad}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
                if (!key) return <View key={i} style={styles.numpadEmpty} />;
                const isDelete = key === '⌫';
                const disabled = !isDelete && pinDigits.length >= 4;
                return (
                  <TouchableOpacity
                    key={key + i}
                    style={[styles.numpadKey, { backgroundColor: colors.surfaceSecondary }, disabled && { opacity: 0.3 }]}
                    onPress={() => handlePinKey(key)}
                    disabled={disabled && !isDelete}
                    activeOpacity={0.6}
                  >
                    {isDelete
                      ? <Ionicons name="backspace-outline" size={22} color={colors.text} />
                      : <Text style={[styles.numpadKeyText, { color: colors.text }]}>{key}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity onPress={closePinModal} style={styles.pinCancelBtn}>
              <Text style={[styles.pinCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Alert Modal */}
      {(() => {
        const iconName = alertModal.type === 'success' ? 'checkmark-circle' : alertModal.type === 'error' ? 'close-circle' : 'information-circle';
        const iconColor = alertModal.type === 'success' ? colors.success : alertModal.type === 'error' ? colors.error : colors.primary;
        const iconBg = alertModal.type === 'success' ? colors.successLight : alertModal.type === 'error' ? colors.errorLight : colors.primaryLight;
        return (
          <Modal visible={alertModal.visible} transparent animationType="fade">
            <View style={styles.alertOverlay}>
              <View style={[styles.alertBox, { backgroundColor: colors.surface }]}>
                <View style={[styles.alertIconWrap, { backgroundColor: iconBg }]}>
                  <Ionicons name={iconName} size={32} color={iconColor} />
                </View>
                <Text style={[styles.alertTitle, { color: colors.text }]}>{alertModal.title}</Text>
                <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>{alertModal.message}</Text>
                <TouchableOpacity
                  style={[styles.alertBtn, { backgroundColor: iconColor }]}
                  onPress={() => setAlertModal(a => ({ ...a, visible: false }))}
                >
                  <Text style={styles.alertBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* Custom Confirm Modal */}
      <Modal visible={confirmModal.visible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={[styles.alertBox, { backgroundColor: colors.surface }]}>
            <View style={[styles.alertIconWrap, { backgroundColor: confirmModal.isDestructive ? colors.errorLight : colors.primaryLight }]}>
              <Ionicons name={confirmModal.isDestructive ? 'warning-outline' : 'help-circle-outline'} size={32} color={confirmModal.isDestructive ? colors.error : colors.primary} />
            </View>
            <Text style={[styles.alertTitle, { color: colors.text }]}>{confirmModal.title}</Text>
            <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>{confirmModal.message}</Text>
            <View style={styles.alertBtnRow}>
              <TouchableOpacity
                style={[styles.alertCancelBtn, { borderColor: colors.border }]}
                onPress={() => setConfirmModal(c => ({ ...c, visible: false }))}
              >
                <Text style={[styles.alertCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertBtn, styles.alertBtnFlex, { backgroundColor: confirmModal.isDestructive ? colors.error : colors.primary }]}
                onPress={() => {
                  setConfirmModal(c => ({ ...c, visible: false }));
                  confirmModal.onConfirm();
                }}
              >
                <Text style={styles.alertBtnText}>{confirmModal.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  balanceButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  withdrawButton: { backgroundColor: '#FFFFFF', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  transferButton: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FFFFFF' },
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
  unlinkButton: { padding: 8 },
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
  // PIN modal
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  pinBox: { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  pinIconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pinTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  pinSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 24 },
  pinDots: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: 'transparent' },
  pinError: { fontSize: 13, textAlign: 'center', marginBottom: 4, height: 20 },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginTop: 16, gap: 12 },
  numpadKey: { width: '28%', aspectRatio: 1.4, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numpadEmpty: { width: '28%' },
  numpadKeyText: { fontSize: 22, fontWeight: '600' },
  pinCancelBtn: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 24 },
  pinCancelText: { fontSize: 15, fontWeight: '500' },
  // Alert/Confirm modals
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  alertBox: { width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 10 },
  alertIconWrap: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  alertMessage: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  alertBtn: { width: '100%', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertBtnFlex: { flex: 1 },
  alertBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  alertBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  alertCancelBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  alertCancelText: { fontWeight: '600', fontSize: 16 },
});
