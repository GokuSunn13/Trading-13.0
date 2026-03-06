/**
 * Authentication Context
 * Zarządza stanem autoryzacji użytkownika w całej aplikacji
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getProfileRest, updateProfileRest } from '../lib/supabaseRest';
import { ensureProfileColumns } from '../lib/supabaseHelpers';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pobierz profil użytkownika - używa REST API
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    
    try {
      // Upewnij się że kolumny telegram_enabled i auto_send_signals istnieją
      await ensureProfileColumns(userId);

      // Użyj REST API zamiast SDK
      const data = await getProfileRest(userId);
      
      if (data) {
        setProfile(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  // Aktualizuj profil - używa REST API
  const updateProfile = useCallback(async (updates) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    try {
      const result = await updateProfileRest(user.id, updates);
      
      if (result.success && result.data) {
        setProfile(result.data);
      }
      return result;
    } catch (err) {
      console.error('Error updating profile:', err);
      return { success: false, error: err.message };
    }
  }, [user]);

  // Logowanie email/hasło
  const signInWithEmail = useCallback(async (email, password) => {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Rejestracja email/hasło
  const signUpWithEmail = useCallback(async (email, password, fullName) => {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Logowanie przez Google
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // Wylogowanie
  const signOut = useCallback(async () => {
    if (!supabase) return;
    
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }, []);

  // Reset hasła
  const resetPassword = useCallback(async (email) => {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Nasłuchuj zmian sesji
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Pobierz aktualną sesję
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Error getting session:', err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Nasłuchuj zmian autoryzacji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const value = {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    isConfigured: isSupabaseConfigured(),
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    updateProfile,
    fetchProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
