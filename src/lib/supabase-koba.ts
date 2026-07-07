import { createClient } from '@supabase/supabase-js'

// Client Supabase pour KOBA — fichier dédié côté client uniquement
const KOBA_URL = 'https://xajozimjmbgsgxsaqhbb.supabase.co'
const KOBA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhham96aW1qbWJnc2d4c2FxaGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDU2NDAsImV4cCI6MjA4NzE4MTY0MH0.NWqLZXHDw4tvlmTR_c0lwvMrJl-vhr-N5ghARCWgO2s'

export const kobaSupabase = createClient(KOBA_URL, KOBA_ANON_KEY, {
  auth: {
    storageKey: 'koba-supabase-token',
    persistSession: true,
    autoRefreshToken: true
  }
})
