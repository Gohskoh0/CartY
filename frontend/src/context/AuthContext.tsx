import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface User {
  user_id: string;
  phone: string;
  country: string;
  state: string;
  has_store: boolean;
  store_id: string | null;
  store_slug: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, country: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        api.setToken(storedToken);
        const userData = await api.getMe();
        setUser(userData);
      }
    } catch (error) {
      console.log('Auth load error:', error);
      await AsyncStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, password: string) => {
    const response = await api.login(phone, password);
    await AsyncStorage.setItem('token', response.token);
    setToken(response.token);
    api.setToken(response.token);
    const userData = await api.getMe();
    setUser(userData);
  };

  const register = async (phone: string, password: string, country: string, state: string) => {
    const response = await api.register(phone, password, country, state);
    await AsyncStorage.setItem('token', response.token);
    setToken(response.token);
    api.setToken(response.token);
    const userData = await api.getMe();
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
    api.setToken(null);
  };

  const refreshUser = async () => {
    if (token) {
      const userData = await api.getMe();
      setUser(userData);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
