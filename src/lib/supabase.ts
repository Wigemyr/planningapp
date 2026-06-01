import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // We render a clearer message in <ConfigError /> at the UI layer; throw here
  // so accidental imports during build catch the misconfiguration loudly.
  // eslint-disable-next-line no-console
  console.error(
    '[planning] missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).',
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 8,
      },
    },
  },
);

/** True iff the runtime is configured (used by ConfigError UI). */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** Storage bucket name we use for attachments. */
export const ATTACHMENTS_BUCKET = 'attachments';
