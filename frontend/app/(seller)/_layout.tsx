import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import TabBar from '../../src/components/TabBar';
import SupportFAB from '../../src/components/SupportFAB';

export default function SellerLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={props => (
          <>
            <SupportFAB />
            <TabBar {...props} />
          </>
        )}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="products" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="wallet" />
        <Tabs.Screen name="ads" />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="create-store" options={{ href: null }} />
        <Tabs.Screen name="add-product" options={{ href: null }} />
        <Tabs.Screen name="subscribe" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
        <Tabs.Screen name="create-ad" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
