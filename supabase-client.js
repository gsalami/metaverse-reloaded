import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.3/+esm';

const SUPABASE_URL = 'https://loggcpgijlckkcsiiflv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LgnCzQ7YD6mHMbOG3ljwOQ_BTOXwCSB';

export function isSupabaseConfigured() {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(SUPABASE_URL)
    && /^(sb_publishable_|eyJ)/.test(SUPABASE_PUBLISHABLE_KEY);
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

function notConfigured() {
  return {
    data: null,
    error: new Error('Supabase ist noch nicht vollständig konfiguriert.')
  };
}

export async function signInWithMagicLink(email, redirectTo = window.location.href) {
  if (!supabase) return notConfigured();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true
    }
  });
}

export async function signOut() {
  if (!supabase) return notConfigured();
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return notConfigured();
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback) {
  if (!supabase) {
    return {
      data: {
        subscription: { unsubscribe() {} }
      }
    };
  }
  return supabase.auth.onAuthStateChange(callback);
}
