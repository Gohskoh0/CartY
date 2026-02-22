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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        {!editMode ? (
          <TouchableOpacity onPress={() => setEditMode(true)}>
            <Text style={[styles.editButton, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => { setEditMode(false); Keyboard.dismiss(); }}>
            <Text style={[styles.cancelButton, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.logoSection, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={handleUpdateLogo} disabled={saving}>
            {store?.logo ? (
              <Image source={{ uri: store.logo }} style={styles.logo} />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="storefront-outline" size={48} color={colors.textTertiary} />
              </View>
            )}
            <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.storeName, { color: colors.text }]}>{store?.name}</Text>
          <Text style={[styles.storeSlug, { color: colors.textSecondary }]}>carty.store/{store?.slug}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Store Information</Text>
          
          <Text style={[styles.label, { color: colors.text }]}>Store Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }, !editMode && styles.inputDisabled]}
            value={name}
            onChangeText={setName}
            editable={editMode}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: colors.text }]}>WhatsApp Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }, !editMode && styles.inputDisabled]}
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            keyboardType="phone-pad"
            editable={editMode}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: colors.text }]}>Email (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }, !editMode && styles.inputDisabled]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={editMode}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          {editMode && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
              onPress={handleSaveChanges}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
          
          <View style={styles.themeOptions}>
            {themeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.themeOption,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  themeMode === option.value && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                ]}
                onPress={() => setThemeMode(option.value as any)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={themeMode === option.value ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: themeMode === option.value ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Store Link</Text>
          
          <TouchableOpacity style={[styles.actionItem, { borderBottomColor: colors.border }]} onPress={handleShareStore}>
            <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="share-social-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Share Store Link</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Share your store with customers</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, { borderBottomColor: colors.border }]} onPress={handleCopyLink}>
            <View style={[styles.actionIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="copy-outline" size={24} color={colors.success} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Copy Link</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Copy store URL to clipboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, { borderBottomColor: colors.border }]} onPress={handleOpenStore}>
            <View style={[styles.actionIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="open-outline" size={24} color={colors.warning} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Preview Store</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Open your store in browser</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
          
          <TouchableOpacity
            style={[styles.actionItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/(seller)/subscribe')}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="card-outline" size={24} color={colors.success} />
            </View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Subscription</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                Status: {store?.subscription_status === 'active' ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.textTertiary }]}>CartY v1.0.0</Text>
      </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  editButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  storeSlug: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    padding: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  saveButton: {
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    padding: 20,
  },
});
