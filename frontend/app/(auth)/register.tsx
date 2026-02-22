import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Keyboard,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', currency: 'UGX' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', currency: 'TZS' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'RWF' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', currency: 'ETB' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', currency: 'EGP' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', currency: 'XOF' },
  { code: 'CI', name: 'Ivory Coast', flag: '🇨🇮', currency: 'XOF' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲', currency: 'XAF' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', currency: 'ZMW' },
  { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', currency: 'EUR' },
  { code: 'FR', name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { code: 'IN', name: 'India', flag: '🇮🇳', currency: 'INR' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', currency: 'AED' },
];

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export default function Register() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Nigeria default
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [selectedState, setSelectedState] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [stateSearch, setStateSearch] = useState('');

  const { register } = useAuth();
  const router = useRouter();

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q));
  }, [countrySearch]);

  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return NIGERIA_STATES;
    const q = stateSearch.toLowerCase();
    return NIGERIA_STATES.filter(s => s.toLowerCase().includes(q));
  }, [stateSearch]);

  const isNigeria = selectedCountry.code === 'NG';

  const handleRegister = async () => {
    if (!phone || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (!selectedState) {
      Alert.alert('Error', `Please select your ${isNigeria ? 'state' : 'region/state'}`);
      return;
    }

    setLoading(true);
    try {
      await register(phone, password, selectedCountry.code, selectedState);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>CartY</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start selling in minutes</Text>
          </View>

          <View style={styles.form}>
            {/* Phone */}
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            {/* Country Picker */}
            <Text style={styles.fieldLabel}>Country</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => { Keyboard.dismiss(); setShowCountryPicker(true); }}
            >
              <Text style={styles.pickerFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.pickerText}>{selectedCountry.name}</Text>
              <Ionicons name="chevron-down" size={18} color="#6B7280" />
            </TouchableOpacity>

            {/* State / Region */}
            <Text style={styles.fieldLabel}>{isNigeria ? 'State' : 'State / Region'}</Text>
            {isNigeria ? (
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => { Keyboard.dismiss(); setShowStatePicker(true); }}
              >
                <Ionicons name="location-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <Text style={[styles.pickerText, !selectedState && { color: '#9CA3AF' }]}>
                  {selectedState || 'Select state'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            ) : (
              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="State / Region"
                  placeholderTextColor="#9CA3AF"
                  value={selectedState}
                  onChangeText={setSelectedState}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }} />
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search countries..."
                placeholderTextColor="#9CA3AF"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoFocus
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, selectedCountry.code === item.code && styles.listItemSelected]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setSelectedState('');
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.listItemFlag}>{item.flag}</Text>
                  <Text style={styles.listItemText}>{item.name}</Text>
                  <Text style={styles.listItemSub}>{item.currency}</Text>
                  {selectedCountry.code === item.code && (
                    <Ionicons name="checkmark" size={18} color="#4F46E5" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Nigeria State Picker Modal */}
      <Modal visible={showStatePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowStatePicker(false); setStateSearch(''); }} />
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => { setShowStatePicker(false); setStateSearch(''); }}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search states..."
                placeholderTextColor="#9CA3AF"
                value={stateSearch}
                onChangeText={setStateSearch}
                autoFocus
              />
              {stateSearch.length > 0 && (
                <TouchableOpacity onPress={() => setStateSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, selectedState === item && styles.listItemSelected]}
                  onPress={() => {
                    setSelectedState(item);
                    setShowStatePicker(false);
                    setStateSearch('');
                  }}
                >
                  <Ionicons name="location-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
                  <Text style={styles.listItemText}>{item}</Text>
                  {selectedState === item && (
                    <Ionicons name="checkmark" size={18} color="#4F46E5" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 40, fontWeight: 'bold', color: '#4F46E5', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B7280' },
  form: { width: '100%' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, marginBottom: 14, height: 54,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 12,
    paddingHorizontal: 16, marginBottom: 14, height: 54,
  },
  pickerFlag: { fontSize: 22, marginRight: 10 },
  pickerText: { flex: 1, fontSize: 16, color: '#111827' },
  button: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#A5B4FC' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#6B7280', fontSize: 15 },
  linkText: { color: '#4F46E5', fontSize: 15, fontWeight: '600' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  listItemSelected: { backgroundColor: '#EEF2FF' },
  listItemFlag: { fontSize: 20, marginRight: 12 },
  listItemText: { flex: 1, fontSize: 15, color: '#111827' },
  listItemSub: { fontSize: 13, color: '#9CA3AF', marginRight: 8 },
});
