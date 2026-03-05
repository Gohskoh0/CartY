import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Share,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/services/api';

export default function Settings() {
  const { user, logout } = useAuth();
  const { themeMode, isDark, colors, setThemeMode } = useTheme();
  const router = useRouter();
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchStore();
  }, []);

  const fetchStore = async () => {
    try {
      const data = await api.getMyStore();
      setStore(data);
      setName(data.name);
      setWhatsappNumber(data.whatsapp_number || '');
      setEmail(data.email || '');
    } catch (error) {
      console.log('Store error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSaving(true);
      try {
        const logo = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await api.updateStore({ logo });
        setStore({ ...store, logo });
        Alert.alert('Success', 'Logo updated!');
      } catch (error: any) {
        Alert.alert('Error', error.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      await api.updateStore({
        name,
        whatsapp_number: whatsappNumber,
        email: email || undefined,
      });
      setStore({ ...store, name, whatsapp_number: whatsappNumber, email });
      setEditMode(false);
      Alert.alert('Success', 'Store updated!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStoreUrl = () => {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    return `${baseUrl}/store/${store?.slug}`;
  };

  const handleShareStore = async () => {
    if (!store?.slug) return;
    const storeUrl = getStoreUrl();
    
    try {
      const result = await Share.share({
        message: `Check out my store "${store.name}" on CartY!\n\n${storeUrl}`,
        title: `${store.name} - CartY Store`,
      });
      
      if (result.action === Share.dismissedAction) {
        // User dismissed, do nothing
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share store link');
    }
  };

  const handleCopyLink = async () => {
    if (!store?.slug) return;
    const storeUrl = getStoreUrl();
    try {
      await Clipboard.setStringAsync(storeUrl);
      Alert.alert('Copied!', 'Store link copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const handleOpenStore = () => {
    if (!store?.slug) return;
    const storeUrl = getStoreUrl();
    Linking.openURL(storeUrl);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const Row = ({ icon, iconBg, iconColor, title, subtitle, onPress, last }: any) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: last ? 'transparent' : colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        {!editMode ? (
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.primaryLight }]}
            onPress={() => setEditMode(true)}
          >
            <Text style={[styles.editBtnText, { color: colors.primary }]}>Edit Store</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => { setEditMode(false); Keyboard.dismiss(); }}>
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Profile hero */}
          <View style={[styles.profileSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleUpdateLogo} disabled={saving} style={styles.logoWrap}>
              {store?.logo ? (
                <Image source={{ uri: store.logo }} style={styles.logo} />
              ) : (
                <View style={[styles.logoPlaceholder, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.logoInitials, { color: colors.primary }]}>
                    {(store?.name || 'S')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={[styles.storeName, { color: colors.text }]}>{store?.name}</Text>
            <Text style={[styles.storeSlug, { color: colors.textSecondary }]}>/store/{store?.slug}</Text>
          </View>

          {/* Store info edit */}
          {editMode && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>STORE INFORMATION</Text>
              {[
                { label: 'Store Name', value: name, setter: setName, keyboard: 'default' as const },
                { label: 'WhatsApp Number', value: whatsappNumber, setter: setWhatsappNumber, keyboard: 'phone-pad' as const },
                { label: 'Email (optional)', value: email, setter: setEmail, keyboard: 'email-address' as const },
              ].map((field, i) => (
                <View key={i}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, borderColor: colors.border }]}
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={field.keyboard}
                    autoCapitalize="none"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSaveChanges}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Appearance */}
          <View style={styles.sectionGap} />
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
            <View style={styles.themeRow}>
              {themeOptions.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.themeChip, {
                    backgroundColor: themeMode === o.value ? colors.primaryLight : colors.surfaceSecondary,
                    borderColor: themeMode === o.value ? colors.primary : colors.border,
                  }]}
                  onPress={() => setThemeMode(o.value as any)}
                >
                  <Ionicons name={o.icon as any} size={18} color={themeMode === o.value ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.themeChipText, { color: themeMode === o.value ? colors.primary : colors.textSecondary }]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Store Link */}
          <View style={styles.sectionGap} />
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>STORE LINK</Text>
            <Row icon="share-social-outline" iconBg={colors.primaryLight} iconColor={colors.primary}
              title="Share Store Link" subtitle="Share your store with customers" onPress={handleShareStore} />
            <Row icon="copy-outline" iconBg={colors.successLight} iconColor={colors.accent}
              title="Copy Link" subtitle="Copy store URL to clipboard" onPress={handleCopyLink} />
            <Row icon="open-outline" iconBg={colors.warningLight} iconColor={colors.warning}
              title="Preview Store" subtitle="Open your store in browser" onPress={handleOpenStore} last />
          </View>

          {/* Account */}
          <View style={styles.sectionGap} />
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACCOUNT</Text>
            <Row icon="flash-outline" iconBg={colors.successLight} iconColor={colors.accent}
              title="Subscription"
              subtitle={`Status: ${store?.subscription_status === 'active' ? '✓ Active' : 'Inactive'}`}
              onPress={() => router.push('/(seller)/subscribe')} last />
          </View>

          {/* Logout */}
          <View style={styles.sectionGap} />
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.surface }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { color: colors.textTertiary }]}>CartY v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontWeight: '800' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  editBtnText: { fontSize: 13, fontWeight: '700' },
  profileSection: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, borderBottomWidth: 1,
  },
  logoWrap: { position: 'relative', marginBottom: 14 },
  logo: { width: 88, height: 88, borderRadius: 44 },
  logoPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  logoInitials: { fontSize: 36, fontWeight: '800' },
  cameraIcon: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  storeName: { fontSize: 20, fontWeight: '800' },
  storeSlug: { fontSize: 13, marginTop: 4 },
  sectionGap: { height: 8 },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, borderWidth: 1, marginBottom: 4,
  },
  saveBtn: {
    borderRadius: 14, height: 50, alignItems: 'center',
    justifyContent: 'center', marginTop: 16, marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  themeChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  themeChipText: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 18, marginHorizontal: 16, borderRadius: 16,
  },
  logoutText: { fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, paddingVertical: 20 },
});
