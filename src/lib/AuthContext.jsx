import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFranchise, setSelectedFranchiseState] = useState(null);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(
    () => sessionStorage.getItem('needs_password_setup') === 'true'
  );

  // Persist selected franchise to localStorage
  const setSelectedFranchise = useCallback((franchise) => {
    setSelectedFranchiseState(franchise);
    if (franchise) {
      localStorage.setItem('selected_franchise_id', franchise.id);
    } else {
      localStorage.removeItem('selected_franchise_id');
    }
  }, []);

  const clearPasswordSetup = useCallback(() => {
    setNeedsPasswordSetup(false);
    sessionStorage.removeItem('needs_password_setup');
    sessionStorage.removeItem('password_setup_type');
  }, []);

  const loadUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) throw error;

      setUser({
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || authUser.email,
        role: profile?.role || 'franchisee',
        managed_franchise_ids: profile?.managed_franchise_ids || [],
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error('[Auth] Error loading profile:', error);
      // Retry once before falling back
      try {
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        if (retryError) throw retryError;
        setUser({
          id: authUser.id,
          email: authUser.email,
          full_name: retryProfile?.full_name || authUser.email,
          role: retryProfile?.role || 'franchisee',
          managed_franchise_ids: retryProfile?.managed_franchise_ids || [],
        });
        setIsAuthenticated(true);
      } catch (retryErr) {
        console.error('[Auth] Retry failed, using fallback:', retryErr);
        setUser({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.email,
          role: 'franchisee',
          managed_franchise_ids: [],
        });
        setIsAuthenticated(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Detect invite/recovery tokens in URL hash OR search params (PKCE flow)
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const hashType = hash.match(/type=(invite|recovery)/)?.[1];
    const searchType = searchParams.get('type');
    const type = hashType || searchType;

    if (type === 'invite' || type === 'recovery') {
      setNeedsPasswordSetup(true);
      sessionStorage.setItem('needs_password_setup', 'true');
      sessionStorage.setItem('password_setup_type', type);
    }

    const initAuth = async () => {
      try {
        // Handle PKCE code exchange (newer Supabase flow)
        const code = searchParams.get('code');
        if (code) {
          try {
            const { data } = await supabase.auth.exchangeCodeForSession(code);
            // Detect invite: PKCE doesn't pass type=invite in URL
            // If code exchange succeeded, no type was detected from URL,
            // and user hasn't set password yet → this is an invite
            if (data?.user && !type && !data.user.user_metadata?.password_set) {
              setNeedsPasswordSetup(true);
              sessionStorage.setItem('needs_password_setup', 'true');
              sessionStorage.setItem('password_setup_type', 'invite');
            }
            // Clean URL params after exchange
            window.history.replaceState({}, '', window.location.pathname);
          } catch (e) {
            console.error('[Auth] Code exchange failed:', e);
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[Auth] Init error:', error);
        setIsLoading(false);
      }
    };

    initAuth();

    // Safety timeout — if auth check takes too long, stop loading
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          setNeedsPasswordSetup(true);
          sessionStorage.setItem('needs_password_setup', 'true');
          sessionStorage.setItem('password_setup_type', 'recovery');
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const logout = async () => {
    // Clear state immediately so UI reacts even if signOut is slow
    setUser(null);
    setIsAuthenticated(false);
    setSelectedFranchiseState(null);
    localStorage.removeItem('selected_franchise_id');
    sessionStorage.removeItem('needs_password_setup');
    sessionStorage.removeItem('password_setup_type');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Logout error:', e);
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const contextValue = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    isLoadingAuth: isLoading,
    isLoadingPublicSettings: false,
    authError: null,
    appPublicSettings: null,
    needsPasswordSetup,
    clearPasswordSetup,
    selectedFranchise,
    setSelectedFranchise,
    logout,
    navigateToLogin,
    checkAppState: () => {}
  }), [user, isAuthenticated, isLoading, needsPasswordSetup, clearPasswordSetup, selectedFranchise, setSelectedFranchise, logout, navigateToLogin]);

  return (
    <AuthContext.Provider value={contextValue}>
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
