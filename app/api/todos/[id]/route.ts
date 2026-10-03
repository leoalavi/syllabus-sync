import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import type { Todo } from '@/lib/types';
import { logger } from '@/lib/logger';

// More permissive UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  if (!id || id.trim() === '') return false;
  if (UUID_REGEX.test(id)) return true;
  if (/^\d+$/.test(id)) return true;
  if (/^[a-zA-Z0-9_-]+$/.test(id)) return true;
  return false;
}

const dateSchema = z.preprocess((value) => value, z.coerce.date());

const todoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High']).optional(),
  completed: z.boolean().optional(),
  notificationEnabled: z.boolean().optional(),
  color: z.string().optional().nullable(),
  dueDate: dateSchema.optional().nullable(),
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { id } = await params;

      if (!isValidId(id)) {
        console.warn('Invalid todo ID received for PUT:', id);
        return jsonError('Invalid todo ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = todoUpdateSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        return jsonError('Invalid todo payload.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const supabase = await createServerClient();

      const updatePayload: Record<string, unknown> = {};

      if (parsed.data.title !== undefined) {
        updatePayload.title = parsed.data.title;
      }
      if (parsed.data.description !== undefined) {
        updatePayload.description = parsed.data.description;
      }
      if (parsed.data.priority !== undefined) {
        updatePayload.priority = parsed.data.priority;
      }
      if (parsed.data.completed !== undefined) {
        updatePayload.completed = parsed.data.completed;
      }
      if (parsed.data.notificationEnabled !== undefined) {
        updatePayload.notification_enabled = parsed.data.notificationEnabled;
      }
      if (parsed.data.color !== undefined) {
        updatePayload.color = parsed.data.color;
      }
      if (parsed.data.dueDate !== undefined) {
        updatePayload.due_date = parsed.data.dueDate?.toISOString() || null;
      }
      if (parsed.data.completedAt !== undefined) {
        updatePayload.completed_at = parsed.data.completedAt?.toISOString() || null;
      }

      const { data, error } = await supabase
        .from('todos')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return jsonError('Todo not found', 404, ERROR_CODES.NOT_FOUND);
        }
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
        logger.error('Database error updating todo:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess(mapTodoRow(data));
    } catch (error) {
      logger.error('Error updating todo:', error);
      return jsonError('Failed to update todo', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { id } = await params;

      if (!isValidId(id)) {
        console.warn('Invalid todo ID received for DELETE:', id);
        return jsonError('Invalid todo ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      const supabase = await createServerClient();
      const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', userId);

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
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error deleting todo:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess({ id });
    } catch (error) {
      logger.error('Error deleting todo:', error);
      return jsonError('Failed to delete todo', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
