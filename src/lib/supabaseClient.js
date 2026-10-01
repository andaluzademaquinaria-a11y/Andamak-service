import { createClient } from '@supabase/supabase-js'

// Limpiamos la URL por si incluye /rest/v1 o barras inclinadas al final
const getCleanUrl = () => {
  const raw = import.meta.env.VITE_SUPABASE_URL || '';
  if (!raw) return '';
  const baseMatch = raw.match(/^(https:\/\/[^/]+\.supabase\.co)/);
  let url = baseMatch ? baseMatch[1] : raw;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const supabaseUrl = getCleanUrl();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = supabaseUrl.startsWith('http') && supabaseKey.length > 20;

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null;
