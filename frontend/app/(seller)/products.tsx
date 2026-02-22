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
  Image,
  Switch,
  Share,
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
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      console.log('Products error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, []);

  const toggleProductActive = async (product: any) => {
    try {
      await api.updateProduct(product.id, { is_active: !product.is_active });
      setProducts(
        products.map((p) =>
          p.id === product.id ? { ...p, is_active: !p.is_active } : p
        )
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteProduct = async (productId: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteProduct(productId);
              setProducts(products.filter((p) => p.id !== productId));
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const shareProduct = async (product: any) => {
    const storeSlug = user?.store_slug;
    if (!storeSlug) {
      Alert.alert('Error', 'Store not set up yet');
      return;
    }
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const url = `${baseUrl}/store/${storeSlug}`;
    try {
      await Share.share({
        message: `🛍️ ${product.name}\n💰 ₦${Number(product.price).toLocaleString()}\n${product.description ? `\n${product.description}\n` : ''}\nOrder here 👉 ${url}`,
        title: product.name,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(seller)/add-product')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {products.length > 0 ? (
          products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.image ? (
                <Image source={{ uri: product.image }} style={styles.productImage} />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#D1D5DB" />
                </View>
              )}

              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>
                  ₦{(product.price || 0).toLocaleString()}
                </Text>
                {product.description && (
                  <Text style={styles.productDescription} numberOfLines={1}>
                    {product.description}
                  </Text>
                )}
              </View>

              <View style={styles.productActions}>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </Text>
                  <Switch
                    value={product.is_active}
                    onValueChange={() => toggleProductActive(product)}
                    trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
                    thumbColor={product.is_active ? '#4F46E5' : '#9CA3AF'}
                  />
                </View>
                <TouchableOpacity
                  style={styles.shareIconButton}
                  onPress={() => shareProduct(product)}
                >
                  <Ionicons name="share-social-outline" size={18} color="#4F46E5" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteProduct(product.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No products yet</Text>
            <Text style={styles.emptySubtext}>Add your first product to get started</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(seller)/add-product')}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Add Product</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
    marginTop: 4,
  },
  productDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  productActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  switchContainer: {
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  shareIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 8,
  },
});
