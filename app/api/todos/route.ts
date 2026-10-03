import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, ERROR_CODES } from '@/app/api/_lib/response';
import { requireAuth, requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import type { Todo } from '@/lib/types';
import { logger } from '@/lib/logger';

const dateSchema = z.preprocess((value) => value, z.coerce.date());

const todoSchema = z.object({
  id: z.string().min(1).optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title is too long')
    .regex(/^[^<>]*$/, 'Title contains invalid characters'),
  description: z
    .string()
    .max(1000, 'Description is too long')
    .regex(/^[^<>]*$/, 'Description contains invalid characters')
    .optional(),
  priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
  completed: z.boolean().default(false),
  notificationEnabled: z.boolean().optional(),
  color: z.string().optional(),
  dueDate: dateSchema.optional().nullable(),
  createdAt: dateSchema.optional(),
  completedAt: dateSchema.optional().nullable(),
});

// Map database row to Todo type
const mapTodoRow = (row: Record<string, unknown>): Todo => ({
  id: String(row.id ?? ''),
  title: String(row.title ?? ''),
  description: row.description ? String(row.description) : undefined,
  priority: row.priority as Todo['priority'],
  completed: Boolean(row.completed),
  notificationEnabled: Boolean(row.notification_enabled ?? false),
  color: row.color ? String(row.color) : undefined,
  dueDate: row.due_date ? new Date(row.due_date as string) : undefined,
  createdAt: new Date((row.created_at as string) ?? new Date()),
  completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
});

// Serialize Todo for database
const serializeTodo = (todo: Todo & { user_id?: string }) => ({
  id: todo.id,
  user_id: todo.user_id,
  title: todo.title,
  description: todo.description || null,
  priority: todo.priority,
  completed: todo.completed,
  notification_enabled: todo.notificationEnabled ?? false,
  color: todo.color || null,
  due_date: todo.dueDate?.toISOString() || null,
  created_at: todo.createdAt.toISOString(),
  completed_at: todo.completedAt?.toISOString() || null,
});

export async function GET(request: Request) {
  return requireAuth(request, async (userId) => {
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        // Check if the error is related to missing table
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          logger.error(
            'Todos table not found. Please run the migration: supabase/migrations/20260124000000_create_todos_table.sql',
          );
          return jsonError(
            'The todos table is not set up. Please run database migrations.',
            500,
            ERROR_CODES.DATABASE_ERROR,
            { hint: 'Run: npx supabase db push' },
          );
        }
        return jsonError('A database error occurred', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return NextResponse.json(data?.map(mapTodoRow) ?? []);
    } catch (error) {
      logger.error('Todos GET error:', error);
      return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

export async function POST(request: Request) {
  // SECURITY: Rate-limited auth for mutation. CSRF is enforced at proxy level.
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const supabase = await createServerClient();
      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = todoSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        const error: z.ZodError = parsed.error;
        logger.error('Todo validation failed:', JSON.stringify(error.issues, null, 2));
        return jsonError('Invalid todo payload.', 400, ERROR_CODES.VALIDATION_ERROR, {
          errors: error.issues,
        });
      }

      const payload = {
        ...parsed.data,
        id: parsed.data.id ?? crypto.randomUUID(),
        user_id: userId,
        createdAt: parsed.data.createdAt ?? new Date(),
        notificationEnabled: parsed.data.notificationEnabled ?? false,
        dueDate: parsed.data.dueDate ?? undefined,
        completedAt: parsed.data.completedAt ?? undefined,
      };

      const { data, error } = await supabase
        .from('todos')
        .insert(serializeTodo(payload as Todo & { user_id: string }))
        .select('*')
        .single();

      if (error) {
        logger.error('Database error creating todo:', error.code, error.message, error.details);
        // Check if the error is related to missing table
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          logger.error(
            'Todos table not found. Please run the migration: supabase/migrations/20260124000000_create_todos_table.sql',
          );
          return jsonError(
            'The todos table is not set up. Please run database migrations.',
            500,
            ERROR_CODES.DATABASE_ERROR,
            { hint: 'Run: npx supabase db push' },
          );
        }
        // SECURITY: Log actual error server-side, return generic message to client
        return jsonError('Failed to create todo', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return NextResponse.json(mapTodoRow(data));
    } catch (error) {
      logger.error('Todos POST error:', error);
      return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
