import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { mapEventRow } from '@/app/api/_lib/mappers';
import { requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import { logger } from '@/lib/logger';

// More permissive UUID validation - accepts any valid UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to check if ID is valid (UUID or numeric string for legacy data)
function isValidEventId(id: string): boolean {
  if (!id || id.trim() === '') return false;
  // Accept UUIDs
  if (UUID_REGEX.test(id)) return true;
  // Accept numeric IDs (for legacy/static data)
  if (/^\d+$/.test(id)) return true;
  // Accept any alphanumeric string (for flexibility)
  if (/^[a-zA-Z0-9_-]+$/.test(id)) return true;
  return false;
}

const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  building: z.string().optional(),
  room: z.string().optional(),
  category: z.enum(['Career', 'Social', 'Academic', 'Free Food']).optional(),
  color: z.string().optional(),
  imageUrl: z.string().optional(),
  notificationEnabled: z.boolean().optional(),
  startAt: z.preprocess(
    (val) => (typeof val === 'string' ? new Date(val) : val),
    z.date().optional(),
  ),
  endAt: z.preprocess(
    (val) => (val ? (typeof val === 'string' ? new Date(val) : val) : undefined),
    z.date().optional(),
  ),
  allDay: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // SECURITY: Use rate-limited auth for mutation endpoint
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { id } = await params;

      // Validate ID format (accepts UUIDs, numeric IDs, alphanumeric strings)
      if (!isValidEventId(id)) {
        console.warn('Invalid event ID received for PUT:', id);
        return jsonError('Invalid event ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      // SECURITY: Parse with size limit protection
      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = eventUpdateSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        logger.error('Event update validation failed:', parsed.error.issues);
        return jsonError('Invalid event payload.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const supabase = await createServerClient();

      // Build update payload with snake_case column names
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
      if (parsed.data.description !== undefined)
        updatePayload.description = parsed.data.description;
      if (parsed.data.location !== undefined) updatePayload.location = parsed.data.location;
      if (parsed.data.building !== undefined) updatePayload.building = parsed.data.building;
      if (parsed.data.room !== undefined) updatePayload.room = parsed.data.room;
      if (parsed.data.category !== undefined) updatePayload.category = parsed.data.category;
      if (parsed.data.color !== undefined) updatePayload.color = parsed.data.color;
      if (parsed.data.imageUrl !== undefined) updatePayload.image_url = parsed.data.imageUrl;
      if (parsed.data.notificationEnabled !== undefined)
        updatePayload.notification_enabled = parsed.data.notificationEnabled;
      if (parsed.data.startAt !== undefined)
        updatePayload.start_at = parsed.data.startAt.toISOString();
      if (parsed.data.endAt !== undefined) updatePayload.end_at = parsed.data.endAt.toISOString();
      if (parsed.data.allDay !== undefined) updatePayload.all_day = parsed.data.allDay;

      const { data, error } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId) // Security: Only update user's own events
        .is('deleted_at', null) // Don't update soft-deleted events
        .select('*')
        .single();

      if (error) {
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error updating event:', error.code, error.message);
        if (error.code === 'PGRST116') {
          return jsonError('Event not found', 404, ERROR_CODES.NOT_FOUND);
        }
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess(mapEventRow(data));
    } catch (error) {
      logger.error('Error updating event:', error);
      return jsonError('Failed to update event', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // SECURITY: Use rate-limited auth for mutation endpoint
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { id } = await params;

      // Validate ID format (accepts UUIDs, numeric IDs, alphanumeric strings)
      if (!isValidEventId(id)) {
        console.warn('Invalid event ID received for DELETE:', id);
        return jsonError('Invalid event ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      const supabase = await createServerClient();

      // Soft delete: set deleted_at timestamp
      const { error } = await supabase
        .from('events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId); // Security: Only delete user's own events

      if (error) {
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error deleting event:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess({ id });
    } catch (error) {
      logger.error('Error deleting event:', error);
      return jsonError('Failed to delete event', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
