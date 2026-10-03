import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { mapEventRow, serializeEvent } from '@/app/api/_lib/mappers';
import { requireAuth, requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import type { Event } from '@/lib/types';
import { logger } from '@/lib/logger';
import { isValidBuilding } from '@/lib/utils/buildingValidation';

// Schema matching the database: start_at, end_at, all_day
const eventSchema = z.object({
  id: z.string().min(1).optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .regex(/^[^<>]*$/, 'Title contains invalid characters'),
  description: z
    .string()
    .regex(/^[^<>]*$/, 'Description contains invalid characters')
    .default(''),
  location: z
    .string()
    .regex(/^[^<>]*$/, 'Location contains invalid characters')
    .default(''),
  building: z
    .string()
    .regex(/^[^<>]*$/, 'Building contains invalid characters')
    .optional(),
  room: z
    .string()
    .regex(/^[^<>]*$/, 'Room contains invalid characters')
    .optional(),
  category: z.enum(['Career', 'Social', 'Academic', 'Free Food']).default('Academic'),
  color: z.string().optional(),
  imageUrl: z.string().optional(),
  // Primary time fields
  startAt: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date()),
  endAt: z.preprocess(
    (val) => (val ? (typeof val === 'string' ? new Date(val) : val) : undefined),
    z.date().optional(),
  ),
  allDay: z.boolean().default(false),
});

export async function GET(request: Request) {
  return requireAuth(request, async (userId) => {
    try {
      const supabase = await createServerClient();
      // Security: Only return user's own events (like units)
      // Events are user-scoped, not public
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId) // Only user's own events
        .is('deleted_at', null) // Exclude soft-deleted events
        .order('start_at', { ascending: true });

      if (error) {
        // SECURITY: Don't expose internal database error messages to clients
        logger.error('Database error fetching events:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess(data?.map(mapEventRow) ?? []);
    } catch (error) {
      logger.error(
        'Error fetching events:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return jsonError('Failed to fetch events', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

export async function POST(request: Request) {
  // SECURITY: Rate-limited auth for mutation. CSRF is enforced at proxy level.
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      // SECURITY: Parse with size limit protection
      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = eventSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        logger.error('Event validation failed:', JSON.stringify(parsed.error.issues, null, 2));
        logger.error('Request body was:', JSON.stringify(bodyResult.data, null, 2));
        return jsonError('Invalid event payload.', 400, ERROR_CODES.VALIDATION_ERROR, {
          errors: parsed.error.issues,
        });
      }

      // VALIDATION: Check building against the 118 supported buildings
      const building = parsed.data.building;
      if (building && building.trim() !== '' && !isValidBuilding(building)) {
        return jsonError(
          'Building not found in the campus list. Please select a valid building.',
          400,
          ERROR_CODES.VALIDATION_ERROR,
          { field: 'building', value: building },
        );
      }

      const supabase = await createServerClient();

      // Create Event object for serialization
      const eventData: Event & { user_id: string } = {
        id: parsed.data.id ?? crypto.randomUUID(),
        user_id: userId, // Security: Associate event with current user
        title: parsed.data.title,
        description: parsed.data.description,
        location: parsed.data.location,
        building: parsed.data.building,
        room: parsed.data.room,
        category: parsed.data.category,
        color: parsed.data.color,
        imageUrl: parsed.data.imageUrl,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        allDay: parsed.data.allDay,
        // Computed fields for backward compatibility
        date: parsed.data.startAt,
        time: parsed.data.allDay
          ? ''
          : parsed.data.startAt.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }),
      };

      // Log event creation (development debugging)
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'Creating event with serialized payload:',
          JSON.stringify(serializeEvent(eventData), null, 2),
        );
      }

      const { data, error } = await supabase
        .from('events')
        .insert(serializeEvent(eventData))
        .select('*')
        .single();

      if (error) {
        // SECURITY: Don't expose internal database error messages to clients
        logger.error('Database error creating event:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return jsonSuccess(mapEventRow(data), 201);
    } catch (error) {
      logger.error(
        'Error creating event:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return jsonError('Failed to create event', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
