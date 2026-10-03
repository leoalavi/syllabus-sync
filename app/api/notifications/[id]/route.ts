// app/api/notifications/[id]/route.ts
// ============================================
// Individual Notification API Routes
// ============================================

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import {
  jsonSuccess,
  jsonError,
  handleValidationError,
  handleDatabaseError,
  parseJsonBody,
  BODY_SIZE_LIMITS,
  ERROR_CODES,
} from '@/app/api/_lib/response';
import { mapNotificationRow } from '@/app/api/_lib/mappers';
import { requireAuth, requireAuthWithRateLimit } from '@/app/api/_lib/middleware';
import { logger } from '@/lib/logger';

// ============================================================================
// SCHEMAS
// ============================================================================

const updateNotificationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(1000).optional(),
  type: z.enum(['deadline', 'event', 'class', 'system']).optional(),
  read: z.boolean().optional(),
  link: z.string().url().nullable().optional(),
  relatedId: z.string().uuid().nullable().optional(),
});

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * GET /api/notifications/[id] - Get a single notification
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAuth(request, async (userId) => {
    try {
      const supabase = await createServerClient();

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return jsonError('Notification not found', 404, ERROR_CODES.NOT_FOUND);
        }
        return handleDatabaseError(error);
      }

      return jsonSuccess(mapNotificationRow(data));
    } catch (error) {
      logger.error('GET /api/notifications/[id] error:', error);
      return jsonError('Failed to fetch notification', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

/**
 * PUT /api/notifications/[id] - Update a notification
 *
 * Request Body (all fields optional):
 * {
 *   "title": "Updated title",
 *   "message": "Updated message",
 *   "type": "deadline",
 *   "read": true,
 *   "link": "/calendar",
 *   "relatedId": "uuid"
 * }
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const { data: body, error: bodyError } = await parseJsonBody(
        request,
        BODY_SIZE_LIMITS.DEFAULT,
      );
      if (bodyError) return bodyError;
      const supabase = await createServerClient();

      const validationResult = updateNotificationSchema.safeParse(body);
      if (!validationResult.success) {
        return handleValidationError(validationResult.error);
      }

      const updates = validationResult.data;

      // Build update object with snake_case keys
      const dbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.message !== undefined) dbUpdates.message = updates.message;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.read !== undefined) dbUpdates.read = updates.read;
      if (updates.link !== undefined) dbUpdates.link = updates.link;
      if (updates.relatedId !== undefined) dbUpdates.related_id = updates.relatedId;

      if (Object.keys(dbUpdates).length === 0) {
        return jsonError('No valid fields to update', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const { data, error } = await supabase
        .from('notifications')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return jsonError('Notification not found', 404, ERROR_CODES.NOT_FOUND);
        }
        return handleDatabaseError(error);
      }

      return jsonSuccess(mapNotificationRow(data));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error);
      }
      logger.error('PUT /api/notifications/[id] error:', error);
      return jsonError('Failed to update notification', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

/**
 * PATCH /api/notifications/[id] - Partially update a notification (same as PUT)
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return PUT(request, { params });
}

/**
 * DELETE /api/notifications/[id] - Delete a notification
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const supabase = await createServerClient();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('notifications')
        .update({ deleted_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select('id')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return jsonError('Notification not found', 404, ERROR_CODES.NOT_FOUND);
        }
        return handleDatabaseError(error);
      }

      return jsonSuccess({ deleted: true, id: data.id });
    } catch (error) {
      logger.error('DELETE /api/notifications/[id] error:', error);
      return jsonError('Failed to delete notification', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
