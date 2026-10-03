import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { mapDeadlineRow } from '@/app/api/_lib/mappers';
import { requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import { logger } from '@/lib/logger';

// More permissive UUID validation - accepts any valid UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to check if ID is valid
function isValidId(id: string): boolean {
  if (!id || id.trim() === '') return false;
  if (UUID_REGEX.test(id)) return true;
  if (/^\d+$/.test(id)) return true;
  if (/^[a-zA-Z0-9_-]+$/.test(id)) return true;
  return false;
}

const dateSchema = z.preprocess((value) => value, z.coerce.date());
const deadlineUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  unitCode: z.string().min(1).optional(),
  building: z.string().optional(), // For exams: building code
  room: z.string().optional(), // For exams: room number
  color: z.string().optional(), // Custom color override
  dueDate: dateSchema.optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  type: z.enum(['Assignment', 'Exam', 'Quiz', 'Presentation']).optional(),
  completed: z.boolean().optional(),
  notificationEnabled: z.boolean().optional(), // Whether notifications are enabled
  createdAt: dateSchema.optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // SECURITY: Use rate-limited auth for mutation endpoint
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { id } = await params;

      // Validate ID format
      if (!isValidId(id)) {
        console.warn('Invalid deadline ID received for PUT:', id);
        return jsonError('Invalid deadline ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      // SECURITY: Parse with size limit protection
      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = deadlineUpdateSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        return jsonError('Invalid deadline payload.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const supabase = await createServerClient();

      const updatePayload: Record<string, unknown> = {
        ...parsed.data,
      };
      if (parsed.data.unitCode) {
        updatePayload.unit_code = parsed.data.unitCode;
        delete updatePayload.unitCode;
      }
      if (parsed.data.dueDate) {
        updatePayload.due_date = parsed.data.dueDate.toISOString();
        delete updatePayload.dueDate;
      }
      if (parsed.data.createdAt) {
        updatePayload.created_at = parsed.data.createdAt.toISOString();
        delete updatePayload.createdAt;
      }
      if (parsed.data.notificationEnabled !== undefined) {
        updatePayload.notification_enabled = parsed.data.notificationEnabled;
        delete updatePayload.notificationEnabled;
      }

      const { data, error } = await supabase
        .from('deadlines')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return jsonError('Deadline not found', 404, ERROR_CODES.NOT_FOUND);
        }
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error updating deadline:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess(mapDeadlineRow(data));
    } catch (error) {
      logger.error('Error updating deadline:', error);
      return jsonError('Failed to update deadline', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // SECURITY: Use rate-limited auth for mutation endpoint
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { id } = await params;

      // Validate ID format
      if (!isValidId(id)) {
        console.warn('Invalid deadline ID received for DELETE:', id);
        return jsonError('Invalid deadline ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      const supabase = await createServerClient();

      // SOFT DELETE: Set deleted_at instead of hard delete
      const { error } = await supabase
        .from('deadlines')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error deleting deadline:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess({ id });
    } catch (error) {
      logger.error('Error deleting deadline:', error);
      return jsonError('Failed to delete deadline', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
