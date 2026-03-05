import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, Image, Switch, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';

export default function Products() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProducts = async () => {
    try { setProducts(await api.getProducts()); }
    catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchProducts(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchProducts(); }, []);

  const toggleActive = async (product: any) => {
    try {
      await api.updateProduct(product.id, { is_active: !product.is_active });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const deleteProduct = (id: string) => {
    Alert.alert('Delete Product', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.deleteProduct(id);
          setProducts(prev => prev.filter(p => p.id !== id));
        } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  const shareProduct = async (product: any) => {
    const slug = user?.store_slug;
    if (!slug) return;
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL || ''}/store/${slug}`;
    try {
      await Share.share({ message: `${product.name}\n₦${Number(product.price).toLocaleString()}\n${url}` });
    } catch { /* silent */ }
  };

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
        <Text style={[styles.title, { color: colors.text }]}>Products</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(seller)/add-product')}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {products.length > 0 ? (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: product }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Product image */}
              {product.image ? (
                <Image source={{ uri: product.image }} style={styles.img} />
              ) : (
                <View style={[styles.imgPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
                </View>
              )}

              {/* Info */}
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{product.name}</Text>
                <Text style={[styles.price, { color: colors.primary }]}>₦{(product.price || 0).toLocaleString()}</Text>
                {product.description ? (
                  <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={1}>{product.description}</Text>
                ) : null}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <View style={styles.switchWrap}>
                  <Switch
                    value={product.is_active}
                    onValueChange={() => toggleActive(product)}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={product.is_active ? colors.primary : colors.textTertiary}
                    ios_backgroundColor={colors.border}
                  />
                  <Text style={[styles.switchLabel, { color: product.is_active ? colors.accent : colors.textTertiary }]}>
                    {product.is_active ? 'Live' : 'Off'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
                  onPress={() => shareProduct(product)}
                >
                  <Ionicons name="share-social-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: colors.errorLight }]}
                  onPress={() => deleteProduct(product.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No products yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Add your first product to start selling</Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(seller)/add-product')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.emptyBtnText}>Add Product</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
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
  addBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 12, borderWidth: 1,
  },
  img: { width: 72, height: 72, borderRadius: 12 },
  imgPlaceholder: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  price: { fontSize: 16, fontWeight: '800' },
  desc: { fontSize: 12 },
  actions: { alignItems: 'center', gap: 8 },
  switchWrap: { alignItems: 'center', gap: 2 },
  switchLabel: { fontSize: 10, fontWeight: '600' },
  iconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
