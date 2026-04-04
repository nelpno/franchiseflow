import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [selectedFranchise, setSelectedFranchiseState] = useState(null);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(
    () => sessionStorage.getItem('needs_password_setup') === 'true'
  );
  const lastAuthUserRef = React.useRef(null);
  const lastSignedInTimeRef = React.useRef(0);
  const loginSafetyTimerRef = React.useRef(null);

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

    lastAuthUserRef.current = authUser;
    setProfileLoadFailed(false);

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, managed_franchise_ids')
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

      // Identify user in Microsoft Clarity for analytics segmentation
      if (window.clarity) {
        window.clarity("identify", authUser.id, null, null, profile?.role || 'franchisee');
        window.clarity("set", "role", profile?.role || 'franchisee');
      }
    } catch (error) {
      console.error('[Auth] Error loading profile:', error);
      // Wait for handle_new_user trigger to finish creating profile (first login)
      await new Promise(resolve => setTimeout(resolve, 800));
      // Retry once after delay
      try {
        const { data: retryProfile, error: retryError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, managed_franchise_ids')
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
        console.error('[Auth] Retry failed, showing retry UI:', retryErr);
        setProfileLoadFailed(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retryProfile = useCallback(async () => {
    setIsLoading(true);
    setProfileLoadFailed(false);
    try {
      // Get fresh session — lastAuthUserRef may be stale if session expired
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        // Session expired — redirect to login
        setIsLoading(false);
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('[Auth] Retry failed:', e);
      setProfileLoadFailed(true);
      setIsLoading(false);
    }
  }, [loadUserProfile]);

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

    // Safety timeout — if auth check hangs completely, show retry UI instead of infinite spinner
    const timeout = setTimeout(() => {
      // Only fire if still loading (loadUserProfile didn't finish yet)
      setIsLoading(prev => {
        if (prev) {
          console.warn('[Auth] Safety timeout fired — profile load took >8s');
          setProfileLoadFailed(true);
        }
        return false;
      });
    }, 8000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          setNeedsPasswordSetup(true);
          sessionStorage.setItem('needs_password_setup', 'true');
          sessionStorage.setItem('password_setup_type', 'recovery');
          setIsLoading(true);
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_IN' && session?.user) {
          lastSignedInTimeRef.current = Date.now();

          // If already authenticated with same user (tab refocus token refresh), skip reload
          const alreadyAuthenticated = lastAuthUserRef.current?.id === session.user.id;
          if (alreadyAuthenticated) return;

          setIsLoading(true);

          // Safety timeout: if profile load hangs >10s, show retry UI
          const signInTime = lastSignedInTimeRef.current;
          if (loginSafetyTimerRef.current) clearTimeout(loginSafetyTimerRef.current);
          loginSafetyTimerRef.current = setTimeout(() => {
            if (lastSignedInTimeRef.current === signInTime) {
              console.warn('[Auth] Login safety timeout — profile load took >10s');
              setIsLoading(false);
              setProfileLoadFailed(true);
            }
            loginSafetyTimerRef.current = null;
          }, 10000);

          await loadUserProfile(session.user);
          if (loginSafetyTimerRef.current) {
            clearTimeout(loginSafetyTimerRef.current);
            loginSafetyTimerRef.current = null;
          }
        } else if (event === 'SIGNED_OUT') {
          // Guard: ignore stale SIGNED_OUT if a SIGNED_IN fired recently (race condition)
          const msSinceSignIn = Date.now() - lastSignedInTimeRef.current;
          if (msSinceSignIn < 3000) {
            console.warn('[Auth] Ignoring stale SIGNED_OUT — SIGNED_IN fired', msSinceSignIn, 'ms ago');
            return;
          }
          setUser(null);
          setIsAuthenticated(false);
          setProfileLoadFailed(false);
          setIsLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      if (loginSafetyTimerRef.current) clearTimeout(loginSafetyTimerRef.current);
      subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  const logout = useCallback(async () => {
    // Clear state immediately so UI reacts even if signOut is slow
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    setProfileLoadFailed(false);
    setSelectedFranchiseState(null);
    lastAuthUserRef.current = null;
    localStorage.removeItem('selected_franchise_id');
    sessionStorage.removeItem('needs_password_setup');
    sessionStorage.removeItem('password_setup_type');
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Logout error:', e);
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

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
    profileLoadFailed,
    retryProfile,
    selectedFranchise,
    setSelectedFranchise,
    logout,
    navigateToLogin,
    checkAppState: () => {}
  }), [user, isAuthenticated, isLoading, needsPasswordSetup, clearPasswordSetup, profileLoadFailed, retryProfile, selectedFranchise, setSelectedFranchise, logout, navigateToLogin]);

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
