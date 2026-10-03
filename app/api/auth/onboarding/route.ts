import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { z } from 'zod';
import {
  jsonSuccess,
  jsonError,
  parseJsonBody,
  BODY_SIZE_LIMITS,
  applyNoStoreHeaders,
} from '@/app/api/_lib/response';

const schema = z.object({
  faculty: z.string().min(1),
  course: z.string().min(1),
  year: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { data: body, error: bodyError } = await parseJsonBody(req, BODY_SIZE_LIMITS.AUTH);
  if (bodyError) return bodyError;

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid input', 400);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError('Unauthorized', 401);

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      faculty: parsed.data.faculty,
      course: parsed.data.course,
      year: parsed.data.year,
    },
    { onConflict: 'id' },
  );

  if (error) return jsonError('Failed to update profile', 500);

  return applyNoStoreHeaders(jsonSuccess({ ok: true }));
}
