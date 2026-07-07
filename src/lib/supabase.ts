import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xpnwpumcyqueqjdjqdyz.supabase.co'
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwbndw' +
  'dW1jeXF1ZXFqZGpxZHl6Iiwicm9sZSI6InNlcnZpY2' +
  'Vfcm9sZSIsImlhdCI6MTc3MjU3ODY0OCwiZXhwIjoy' +
  'MDg4MTU0NjQ4fQ.gaH06aNnQA80FHXpXQzCwhWvF2Lg' +
  'DdNlLgElGoqdORo'

// Client service_role — contourne le RLS, schema plans (DB queries)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'plans' },
  auth: { persistSession: false, autoRefreshToken: false },
})

// Client auth admin (list users, create, delete...)
export const supabaseAuthAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Client storage — pas de restriction de schéma (pour Storage API)
export const supabaseStorage = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const BUCKET_NAME = 'ng-plans-assets'

export function getPublicUrl(storagePath: string): string {
  const { data } = supabaseStorage.storage.from(BUCKET_NAME).getPublicUrl(storagePath)
  return data.publicUrl
}

// Client Supabase pour KOBA (partagé)
const KOBA_URL = 'https://xajozimjmbgsgxsaqhbb.supabase.co'
const KOBA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhham96aW1qbWJnc2d4c2FxaGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDU2NDAsImV4cCI6MjA4NzE4MTY0MH0.NWqLZXHDw4tvlmTR_c0lwvMrJl-vhr-N5ghARCWgO2s'

export const kobaSupabase = createClient(KOBA_URL, KOBA_ANON_KEY, {
  auth: {
    storageKey: 'koba-supabase-token',
    persistSession: true,
    autoRefreshToken: true
  }
})

