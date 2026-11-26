/**
 * Whether a Supabase project URL is real (not a placeholder).
 *
 * Hosted projects live on *.supabase.co. Outside production, a local Supabase
 * stack (`supabase start`: http://127.0.0.1:54321 or localhost) is accepted
 * too, so the app can be tested end to end against an isolated database.
 * Production never accepts a local URL.
 */
export function isValidSupabaseUrl(url: string | undefined | null): boolean {
  if (!url || url.includes('your-project-id')) return false;
  if (url.includes('supabase.co')) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const { protocol, hostname } = new URL(url);
    return (
      (protocol === 'http:' || protocol === 'https:') &&
      (hostname === '127.0.0.1' || hostname === 'localhost')
    );
  } catch {
    return false;
  }
}
