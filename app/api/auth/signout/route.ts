import { createServerClient } from '@/lib/supabase/server';
import { jsonSuccess, jsonError } from '@/app/api/_lib/response';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    const supabase = await createServerClient();
    // Current session only; "sign out everywhere" is POST /api/auth/sessions.
    const { error } = await supabase.auth.signOut({ scope: 'local' });

    if (error) {
      logger.error('Signout error:', error);
      return jsonError('Failed to sign out', 400);
    }

    return jsonSuccess({ message: 'Signout successful' });
  } catch (error) {
    logger.error('Signout error:', error);
    return jsonError('Internal server error', 500);
  }
}
