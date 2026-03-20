import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State change:', event);
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser) => {
    const fallbackUser = {
      ...authUser,
      full_name: authUser.user_metadata?.full_name || authUser.email,
      role: 'franchisee',
      managed_franchise_ids: []
    };

    try {
      console.log('[Auth] Loading profile for:', authUser.id);

      // Race between profile fetch and 5s timeout
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);

      console.log('[Auth] Profile result:', { profile, error });

      if (error || !profile) {
        console.warn('[Auth] Profile error, using fallback:', error);
        setUser(fallbackUser);
      } else {
        setUser({ ...authUser, ...profile });
      }
      setIsAuthenticated(true);
    } catch (error) {
      console.error('[Auth] Profile failed:', error.message);
      // Always authenticate even if profile fails
      setUser(fallbackUser);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      // Keep these for backward compatibility with existing pages
      isLoadingAuth: isLoading,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: () => {}
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
