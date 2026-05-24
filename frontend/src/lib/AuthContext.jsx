import React, { createContext, useReducer, useContext, useEffect } from 'react';
import { getSessionSafely, setSupabaseAccessToken, supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditClient';
import { AUDIT_EVENT_TYPES } from '@shared/auditLog';

const AuthContext = createContext();

const initialAuthState = {
  user: null,
  session: null,
  isLoadingAuth: true,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_SET_SESSION': {
      const session = action.payload ?? null;
      return {
        ...state,
        session,
        user: session?.user ?? null,
      };
    }
    case 'AUTH_SET_LOADING':
      return {
        ...state,
        isLoadingAuth: action.payload,
      };
    case 'AUTH_RESET':
      return {
        ...state,
        user: null,
        session: null,
      };
    default:
      return state;
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const { user, session, isLoadingAuth } = state;
  const isAuthenticated = Boolean(session?.user ?? user);

  const handleSession = (session) => {
    setSupabaseAccessToken(session?.access_token ?? null);
    dispatch({ type: 'AUTH_SET_SESSION', payload: session });
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await getSessionSafely();
        if (isMounted) {
          handleSession(session ?? null);
        }
      } finally {
        if (isMounted) {
          dispatch({ type: 'AUTH_SET_LOADING', payload: false });
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session);
        dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw error;

    // CRITICAL: if email confirmation is enabled in Supabase and the user
    // hasn't confirmed yet, data.session will be null even with no error.
    if (!data.session) {
      throw new Error(
        'Confirme seu e-mail antes de entrar. ' +
        'Verifique sua caixa de entrada e clique no link de confirmação.'
      );
    }

    handleSession(data.session);

    logAuditEvent({
      eventType: AUDIT_EVENT_TYPES.AUTH_LOGIN,
      accessToken: data.session.access_token,
      metadata: {
        provider: 'password',
        source: 'AuthContext.signIn',
      },
    }).catch((auditError) => {
      console.warn('[audit] Falha ao registrar login bem-sucedido.', auditError);
    });

    return data;
  };

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSupabaseAccessToken(null);
    dispatch({ type: 'AUTH_RESET' });
    window.location.href = '/login';
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userEmail: user?.email ?? null,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      signIn,
      signUp,
      signInWithGoogle,
      logout,
      navigateToLogin: () => { window.location.href = '/login'; },
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
