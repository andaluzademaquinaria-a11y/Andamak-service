import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Verificación para evitar bloqueos si faltan las credenciales
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
