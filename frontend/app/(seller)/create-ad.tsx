import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

const STEPS = ['Platform', 'Creative', 'Audience', 'Budget', 'Payment'];

const PLATFORMS = [
  { id: 'meta',   label: 'Meta',   sub: 'Facebook & Instagram', icon: 'logo-facebook', color: '#1877F2' },
  { id: 'tiktok', label: 'TikTok', sub: 'TikTok Feed & Stories', icon: 'musical-notes', color: '#FF0050' },
];

const OBJECTIVES = [
  { id: 'traffic',   label: 'Traffic',    sub: 'Drive link clicks to your store', icon: 'link-outline' },
  { id: 'awareness', label: 'Awareness',  sub: 'Reach more people', icon: 'eye-outline' },
  { id: 'sales',     label: 'Sales',      sub: 'Find buyers ready to purchase', icon: 'bag-handle-outline' },
];

const DURATIONS = [
  { days: 3,  label: '3 Days' },
  { days: 7,  label: '7 Days' },
  { days: 14, label: '14 Days' },
];

const GENDERS = [
  { id: 'all',    label: 'All' },
  { id: 'male',   label: 'Men' },
  { id: 'female', label: 'Women' },
];

const LOCATIONS = ['NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'SN', 'CI', 'CM', 'EG'];
const LOCATION_NAMES: Record<string, string> = {
  NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa',
  TZ: 'Tanzania', UG: 'Uganda', SN: 'Senegal', CI: 'Côte d\'Ivoire',
  CM: 'Cameroon', EG: 'Egypt',
};

const ADS_MARGIN = 0.15; // 15%
const MIN_DAILY_BUDGET = 500;

export default function CreateAd() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [step, setStep] = useState(0);

  // Step 1
  const [platform, setPlatform] = useState('');
  const [objective, setObjective] = useState('');

  // Step 2
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [adImage, setAdImage] = useState('');

  // Step 3
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(45);
  const [gender, setGender] = useState('all');
  const [locations, setLocations] = useState<string[]>([user?.country || 'NG']);

  // Step 4
  const [dailyBudget, setDailyBudget] = useState('');
  const [durationDays, setDurationDays] = useState(7);

  // Step 5 — payment
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [pendingRef, setPendingRef] = useState('');
  const [pendingCampaignId, setPendingCampaignId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const budget = parseFloat(dailyBudget || '0') * durationDays;
  const fee = budget * ADS_MARGIN;
  const total = budget + fee;

  const canNext = () => {
    if (step === 0) return platform && objective;
    if (step === 1) return headline.trim().length > 0;
    if (step === 2) return locations.length > 0;
    if (step === 3) return parseFloat(dailyBudget || '0') >= MIN_DAILY_BUDGET;
    return true;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setAdImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const toggleLocation = (code: string) => {
    setLocations(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const handlePay = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Create campaign
      const expiryParts = expiry.replace('/', '').padEnd(4, '0');
      const campaign = await api.createAdCampaign({
        platform, objective,
        ad_headline: headline, ad_description: description,
        ad_image: adImage || undefined,
        target_age_min: ageMin, target_age_max: ageMax,
        target_gender: gender, target_locations: locations,
        budget_ngn: total,
      });

      // Charge card
      const cardDigits = cardNumber.replace(/\s/g, '');
      const result = await api.chargeAdCard({
        campaign_id: campaign.id,
        card_number: cardDigits,
        expiry_month: expiryParts.slice(0, 2),
        expiry_year: expiryParts.slice(2),
        cvv,
      });

      if (result.status === 'send_otp' || result.status === 'pay_offline') {
        setPendingRef(result.reference);
        setPendingCampaignId(campaign.id);
        setOtpStep(true);
      } else {
        setSuccess(true);
      }
    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtp = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.submitAdOtp(pendingRef, otp, pendingCampaignId);
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.successScreen}>
          <View style={[styles.successIcon, { backgroundColor: colors.successLight }]}>
            <Ionicons name="checkmark-circle" size={72} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Campaign Submitted!</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            Your campaign is paid and queued. CartY will launch it within 24 hours. You'll get a notification when it goes live.
          </Text>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(seller)/ads')}
          >
            <Text style={styles.doneBtnText}>View My Campaigns</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{STEPS[step]}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Step {step + 1} of {STEPS.length}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((step + 1) / STEPS.length) * 100}%` as any }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ——— Step 0: Platform & Objective ——— */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>CHOOSE PLATFORM</Text>
              {PLATFORMS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.optionCard, {
                    backgroundColor: colors.surface,
                    borderColor: platform === p.id ? p.color : colors.border,
                    borderWidth: platform === p.id ? 2 : 1,
                  }]}
                  onPress={() => setPlatform(p.id)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: p.color + '22' }]}>
                    <Ionicons name={p.icon as any} size={28} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{p.label}</Text>
                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>{p.sub}</Text>
                  </View>
                  {platform === p.id && <Ionicons name="checkmark-circle" size={22} color={p.color} />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 24 }]}>CAMPAIGN OBJECTIVE</Text>
              {OBJECTIVES.map(o => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.optionCard, {
                    backgroundColor: colors.surface,
                    borderColor: objective === o.id ? colors.primary : colors.border,
                    borderWidth: objective === o.id ? 2 : 1,
                  }]}
                  onPress={() => setObjective(o.id)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: objective === o.id ? colors.primaryLight : colors.surfaceSecondary }]}>
                    <Ionicons name={o.icon as any} size={22} color={objective === o.id ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{o.label}</Text>
                    <Text style={[styles.optionSub, { color: colors.textSecondary }]}>{o.sub}</Text>
                  </View>
                  {objective === o.id && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ——— Step 1: Ad Creative ——— */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>AD IMAGE (OPTIONAL)</Text>
              <TouchableOpacity
                style={[styles.imagePicker, {
                  backgroundColor: colors.surface, borderColor: colors.border,
                  height: adImage ? 200 : 120,
                }]}
                onPress={pickImage}
              >
                {adImage ? (
                  <Image source={{ uri: adImage }} style={styles.adImagePreview} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                    <Text style={[styles.imagePickerText, { color: colors.textTertiary }]}>Tap to upload image</Text>
                  </View>
                )}
              </TouchableOpacity>
              {adImage && (
                <TouchableOpacity onPress={() => setAdImage('')} style={styles.removeImage}>
                  <Text style={[styles.removeImageText, { color: colors.error }]}>Remove image</Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 20 }]}>AD HEADLINE *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={headline}
                onChangeText={t => setHeadline(t.slice(0, 40))}
                placeholder="e.g. Shop the Best Fashion Deals"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>{headline.length}/40</Text>

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 16 }]}>AD DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                value={description}
                onChangeText={t => setDescription(t.slice(0, 125))}
                placeholder="Tell people what makes your store special..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={4}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>{description.length}/125</Text>

              {/* Preview card */}
              {headline.trim().length > 0 && (
                <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>AD PREVIEW</Text>
                  {adImage ? (
                    <Image source={{ uri: adImage }} style={styles.previewImage} />
                  ) : (
                    <View style={[styles.previewImagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={[styles.previewHeadline, { color: colors.text }]}>{headline}</Text>
                  {description ? <Text style={[styles.previewDesc, { color: colors.textSecondary }]}>{description}</Text> : null}
                  <View style={[styles.previewCta, { backgroundColor: colors.primary }]}>
                    <Text style={styles.previewCtaText}>Shop Now</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ——— Step 2: Target Audience ——— */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>AGE RANGE</Text>
              <View style={[styles.ageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.ageControl}>
                  <Text style={[styles.ageControlLabel, { color: colors.textSecondary }]}>Min Age</Text>
                  <View style={styles.ageButtons}>
                    <TouchableOpacity
                      style={[styles.ageBtn, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={() => setAgeMin(Math.max(18, ageMin - 1))}
                    >
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.ageValue, { color: colors.text }]}>{ageMin}</Text>
                    <TouchableOpacity
                      style={[styles.ageBtn, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={() => setAgeMin(Math.min(ageMax - 1, ageMin + 1))}
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.ageDash, { color: colors.textSecondary }]}>—</Text>
                <View style={styles.ageControl}>
                  <Text style={[styles.ageControlLabel, { color: colors.textSecondary }]}>Max Age</Text>
                  <View style={styles.ageButtons}>
                    <TouchableOpacity
                      style={[styles.ageBtn, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={() => setAgeMax(Math.max(ageMin + 1, ageMax - 1))}
                    >
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.ageValue, { color: colors.text }]}>{ageMax}</Text>
                    <TouchableOpacity
                      style={[styles.ageBtn, { backgroundColor: colors.surfaceSecondary }]}
                      onPress={() => setAgeMax(Math.min(65, ageMax + 1))}
                    >
                      <Ionicons name="add" size={18} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 20 }]}>GENDER</Text>
              <View style={styles.genderRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genderChip, {
                      backgroundColor: gender === g.id ? colors.primaryLight : colors.surface,
                      borderColor: gender === g.id ? colors.primary : colors.border,
                    }]}
                    onPress={() => setGender(g.id)}
                  >
                    <Text style={[styles.genderChipText, { color: gender === g.id ? colors.primary : colors.textSecondary }]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 20 }]}>TARGET LOCATIONS</Text>
              <View style={styles.locationGrid}>
                {LOCATIONS.map(code => (
                  <TouchableOpacity
                    key={code}
                    style={[styles.locationChip, {
                      backgroundColor: locations.includes(code) ? colors.primaryLight : colors.surface,
                      borderColor: locations.includes(code) ? colors.primary : colors.border,
                    }]}
                    onPress={() => toggleLocation(code)}
                  >
                    <Text style={[styles.locationChipText, { color: locations.includes(code) ? colors.primary : colors.textSecondary }]}>
                      {LOCATION_NAMES[code]}
                    </Text>
                    {locations.includes(code) && (
                      <Ionicons name="checkmark" size={12} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ——— Step 3: Budget & Duration ——— */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>DAILY BUDGET (MIN ₦{MIN_DAILY_BUDGET.toLocaleString()})</Text>
              <View style={[styles.budgetInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.budgetCurrency, { color: colors.text }]}>₦</Text>
                <TextInput
                  style={[styles.budgetInput, { color: colors.text }]}
                  value={dailyBudget}
                  onChangeText={t => setDailyBudget(t.replace(/\D/g, ''))}
                  keyboardType="numeric"
                  placeholder="5000"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={[styles.budgetSuffix, { color: colors.textSecondary }]}>/day</Text>
              </View>

              <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 20 }]}>CAMPAIGN DURATION</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map(d => (
                  <TouchableOpacity
                    key={d.days}
                    style={[styles.durationChip, {
                      backgroundColor: durationDays === d.days ? colors.primaryLight : colors.surface,
                      borderColor: durationDays === d.days ? colors.primary : colors.border,
                    }]}
                    onPress={() => setDurationDays(d.days)}
                  >
                    <Text style={[styles.durationText, { color: durationDays === d.days ? colors.primary : colors.text }]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cost breakdown */}
              <View style={[styles.breakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.breakdownTitle, { color: colors.text }]}>Cost Breakdown</Text>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Ad Spend ({durationDays} days)</Text>
                  <Text style={[styles.breakdownValue, { color: colors.text }]}>₦{budget.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>CartY Service Fee (15%)</Text>
                  <Text style={[styles.breakdownValue, { color: colors.text }]}>₦{fee.toLocaleString()}</Text>
                </View>
                <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.breakdownTotal, { color: colors.primary }]}>₦{total.toLocaleString()}</Text>
                </View>
              </View>

              <View style={[styles.reachEstimate, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <Text style={[styles.reachText, { color: colors.primary }]}>
                  Estimated reach: {Math.round(budget * 2.5).toLocaleString()} – {Math.round(budget * 5).toLocaleString()} people
                </Text>
              </View>
            </View>
          )}

          {/* ——— Step 4: Payment ——— */}
          {step === 4 && (
            <View style={styles.stepContent}>
              {/* Summary */}
              <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Campaign Summary</Text>
                <SummaryRow label="Platform" value={platform === 'meta' ? 'Meta (Facebook & Instagram)' : 'TikTok'} colors={colors} />
                <SummaryRow label="Objective" value={objective.charAt(0).toUpperCase() + objective.slice(1)} colors={colors} />
                <SummaryRow label="Headline" value={headline} colors={colors} />
                <SummaryRow label="Duration" value={`${durationDays} days`} colors={colors} />
                <SummaryRow label="Audience" value={`${ageMin}–${ageMax} yrs · ${gender}`} colors={colors} />
                <View style={[styles.summaryTotal, { borderTopColor: colors.border }]}>
                  <Text style={[styles.summaryTotalLabel, { color: colors.textSecondary }]}>Total to Pay</Text>
                  <Text style={[styles.summaryTotalValue, { color: colors.primary }]}>₦{total.toLocaleString()}</Text>
                </View>
              </View>

              {!otpStep ? (
                <>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 20 }]}>CARD DETAILS</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={cardNumber}
                    onChangeText={t => setCardNumber(formatCardNumber(t))}
                    placeholder="Card Number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    maxLength={19}
                  />
                  <View style={styles.cardRow}>
                    <TextInput
                      style={[styles.input, styles.cardHalf, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                      value={expiry}
                      onChangeText={t => setExpiry(formatExpiry(t))}
                      placeholder="MM/YY"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={5}
                    />
                    <TextInput
                      style={[styles.input, styles.cardHalf, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                      value={cvv}
                      onChangeText={t => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                      placeholder="CVV"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      maxLength={4}
                      secureTextEntry
                    />
                  </View>
                  {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.payBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
                    onPress={handlePay}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.payBtnText}>Pay ₦{total.toLocaleString()}</Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.otpInfo, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                    <Text style={[styles.otpInfoText, { color: colors.primary }]}>
                      Your bank sent an OTP to verify this payment.
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary, marginTop: 16 }]}>ENTER OTP</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={otp}
                    onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter OTP"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.payBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
                    onPress={handleOtp}
                    disabled={submitting}
                  >
                    {submitting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.payBtnText}>Verify & Pay</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Next / Back buttons */}
      {step < STEPS.length - 1 && (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canNext() ? colors.primary : colors.border }]}
            onPress={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
          >
            <Text style={[styles.nextBtnText, { color: canNext() ? '#fff' : colors.textTertiary }]}>
              Continue
            </Text>
            <Ionicons name="arrow-forward" size={18} color={canNext() ? '#fff' : colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, colors }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  content: { padding: 20, paddingBottom: 32 },
  stepContent: { gap: 4 },
  stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, marginTop: 4 },

  // Option cards (Platform / Objective)
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  optionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '700' },
  optionSub: { fontSize: 13, marginTop: 2 },

  // Creative
  imagePicker: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  imagePickerText: { fontSize: 13 },
  adImagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImage: { alignSelf: 'flex-end', marginTop: 6 },
  removeImageText: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, borderWidth: 1, marginBottom: 4 },
  textArea: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, textAlign: 'right', marginBottom: 8 },
  previewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, marginTop: 16 },
  previewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  previewImage: { width: '100%', height: 160, borderRadius: 10, resizeMode: 'cover' },
  previewImagePlaceholder: { width: '100%', height: 160, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewHeadline: { fontSize: 15, fontWeight: '700' },
  previewDesc: { fontSize: 13, lineHeight: 20 },
  previewCta: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  previewCtaText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Audience
  ageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 14, borderWidth: 1, padding: 16 },
  ageControl: { alignItems: 'center', gap: 8 },
  ageControlLabel: { fontSize: 12, fontWeight: '600' },
  ageButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ageBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ageValue: { fontSize: 22, fontWeight: '800', minWidth: 36, textAlign: 'center' },
  ageDash: { fontSize: 20, fontWeight: '300' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  genderChipText: { fontSize: 14, fontWeight: '600' },
  locationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  locationChipText: { fontSize: 13, fontWeight: '500' },

  // Budget
  budgetInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 56 },
  budgetCurrency: { fontSize: 20, fontWeight: '700', marginRight: 6 },
  budgetInput: { flex: 1, fontSize: 22, fontWeight: '700' },
  budgetSuffix: { fontSize: 14 },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationChip: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  durationText: { fontSize: 14, fontWeight: '700' },
  breakdown: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginTop: 16 },
  breakdownTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13 },
  breakdownValue: { fontSize: 13, fontWeight: '600' },
  breakdownDivider: { height: 1 },
  breakdownTotalLabel: { fontSize: 15, fontWeight: '700' },
  breakdownTotal: { fontSize: 18, fontWeight: '800' },
  reachEstimate: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12 },
  reachText: { flex: 1, fontSize: 13, fontWeight: '500' },

  // Payment
  summary: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 8 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 4 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '600' },
  summaryTotalValue: { fontSize: 20, fontWeight: '800' },
  cardRow: { flexDirection: 'row', gap: 10 },
  cardHalf: { flex: 1 },
  errorText: { fontSize: 13, textAlign: 'center', marginTop: 4 },
  payBtn: { borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  payBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  otpInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14 },
  otpInfoText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Footer (next button)
  footer: { padding: 16, borderTopWidth: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, height: 54 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },

  // Success
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  successIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 24, maxWidth: 320 },
  doneBtn: { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
