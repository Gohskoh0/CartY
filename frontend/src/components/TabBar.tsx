import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Animated,
} from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const TABS: { name: string; icon: string; activeIcon: string; label: string }[] = [
  { name: 'dashboard', icon: 'grid-outline', activeIcon: 'grid', label: 'Dashboard' },
  { name: 'products', icon: 'cube-outline', activeIcon: 'cube', label: 'Products' },
  { name: 'orders', icon: 'receipt-outline', activeIcon: 'receipt', label: 'Orders' },
  { name: 'wallet', icon: 'wallet-outline', activeIcon: 'wallet', label: 'Wallet' },
  { name: 'ads', icon: 'megaphone-outline', activeIcon: 'megaphone', label: 'Ads' },
];

function TabItem({ route, isActive, onPress }: { route: any; isActive: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const tab = TABS.find(t => t.name === route.name) ?? TABS[0];

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.12 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [isActive]);

  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <View style={[styles.iconWrap, isActive && { backgroundColor: colors.primaryLight }]}>
          <Ionicons
            name={(isActive ? tab.activeIcon : tab.icon) as any}
            size={22}
            color={isActive ? colors.primary : colors.textTertiary}
          />
        </View>
        <Text style={[styles.label, { color: isActive ? colors.primary : colors.textTertiary }]}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabBar({ state, descriptors, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r: any) =>
    TABS.some(t => t.name === r.name)
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 16 : 8),
        },
      ]}
    >
      {visibleRoutes.map((route: any) => {
        const isFocused = state.index === state.routes.indexOf(route);
        return (
          <TabItem
            key={route.key}
            route={route}
            isActive={isFocused}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabInner: { alignItems: 'center', gap: 3 },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});
