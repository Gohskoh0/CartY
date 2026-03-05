import React, { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '../src/services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch {
    return null;
  }
}

/** Compare semver strings. Returns true if `a` > `b`. */
function isNewerVersion(a: string, b: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}

function UpdateChecker() {
  useEffect(() => {
    const appVersion = Constants.expoConfig?.version ?? '1.0.0';
    api.checkVersion().then((data) => {
      const { current_version, min_version, android_download_url, ios_download_url, release_notes } = data;
      const downloadUrl = Platform.OS === 'ios' ? ios_download_url : android_download_url;
      const openStore = () => { if (downloadUrl) Linking.openURL(downloadUrl); };

      if (min_version && isNewerVersion(min_version, appVersion)) {
        // Blocking update — required
        Alert.alert(
          'Update Required',
          `A required update is available (v${current_version}).\n\n${release_notes || 'Please update to continue using CartY.'}`,
          [{ text: 'Update Now', onPress: openStore }],
          { cancelable: false }
        );
      } else if (current_version && isNewerVersion(current_version, appVersion)) {
        // Optional update
        Alert.alert(
          'Update Available',
          `CartY v${current_version} is available.\n\n${release_notes || 'New features and improvements.'}`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update', onPress: openStore },
          ]
        );
      }
    }).catch(() => {
      // Silently fail — no update check if offline or server unreachable
    });
  }, []);

  return null;
}

function NotificationSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().then(token => {
      if (token) {
        api.registerPushToken(token).catch(() => {});
      }
    });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen as string;
      if (screen === 'orders') router.push('/(seller)/orders');
      else if (screen === 'wallet') router.push('/(seller)/wallet');
      else if (screen === 'dashboard') router.push('/(seller)/dashboard');
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [user]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <UpdateChecker />
          <NotificationSetup />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(seller)" />
            <Stack.Screen name="store/[slug]" />
          </Stack>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
