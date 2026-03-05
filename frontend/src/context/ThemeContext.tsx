import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryLight: string;
  primaryGradient: [string, string];
  accent: string;
  border: string;
  borderLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  tabBar: string;
  tabBarBorder: string;
}

const lightColors: ThemeColors = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceElevated: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryGradient: ['#6366F1', '#8B5CF6'],
  accent: '#10B981',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
};

const darkColors: ThemeColors = {
  background: '#0A0F1E',
  surface: '#111827',
  surfaceSecondary: '#1F2A3C',
  surfaceElevated: '#243044',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textTertiary: '#4B5563',
  primary: '#6366F1',
  primaryLight: '#1E1B4B',
  primaryGradient: ['#6366F1', '#8B5CF6'],
  accent: '#10B981',
  border: '#2D3B52',
  borderLight: '#1F2A3C',
  success: '#10B981',
  successLight: '#052E16',
  warning: '#FBBF24',
  warningLight: '#451A03',
  error: '#F87171',
  errorLight: '#3B0A0A',
  tabBar: '#111827',
  tabBarBorder: '#1F2A3C',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.log('Error loading theme:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem('themeMode', mode);
  };

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, colors, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
