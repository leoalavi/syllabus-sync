import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, ERROR_CODES } from '@/app/api/_lib/response';
import { mapDeadlineRow, serializeDeadline } from '@/app/api/_lib/mappers';
import { requireAuth, requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import { logger } from '@/lib/logger';
import { isValidBuilding } from '@/lib/utils/buildingValidation';

const dateSchema = z.preprocess((value) => value, z.coerce.date());
const deadlineSchema = z.object({
  id: z.string().min(1).optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .regex(/^[^<>]*$/, 'Title contains invalid characters'),
  unitCode: z
    .string()
    .min(1, 'Unit code is required')
    .regex(/^[^<>]*$/, 'Unit code contains invalid characters')
    .transform((val) => val.trim().toUpperCase()),
  unitId: z.string().optional(),
  building: z.string().optional(), // For exams: building code
  room: z.string().optional(), // For exams: room number
  color: z.string().optional(), // Custom color override
  dueDate: dateSchema,
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  type: z.enum(['Assignment', 'Exam', 'Quiz', 'Presentation']).default('Assignment'),
  completed: z.boolean().default(false),
  createdAt: dateSchema.optional(),
});

export async function GET(request: Request) {
  return requireAuth(request, async (userId) => {
    try {
      const supabase = await createServerClient();
      // Security: Filter by user_id to prevent IDOR - only return user's own deadlines
      // Exclude soft-deleted records
      const { data, error } = await supabase
        .from('deadlines')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('due_date', { ascending: true });

      if (error) {
        return jsonError('A database error occurred', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return NextResponse.json(data?.map(mapDeadlineRow) ?? []);
    } catch (error) {
      logger.error('Deadlines GET error:', error);
      return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}

export async function POST(request: Request) {
  // SECURITY: Rate-limited auth for mutation. CSRF is enforced at proxy level.
  return requireAuthWithRateLimit(request, async (userId) => {
    try {
      const supabase = await createServerClient();
      // SECURITY: Parse with size limit protection
      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = deadlineSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        const error: z.ZodError = parsed.error;
        logger.error('Deadline validation failed:', JSON.stringify(error.issues, null, 2));
        logger.error('Request body was:', JSON.stringify(bodyResult.data, null, 2));
        return jsonError('Invalid deadline payload.', 400, ERROR_CODES.VALIDATION_ERROR, {
          errors: error.issues,
        });
      }

      // VALIDATION: Check building against the 118 supported buildings (for Exams)
      const building = parsed.data.building;
      if (building && building.trim() !== '' && !isValidBuilding(building)) {
        return jsonError(
          'Building not found in the campus list. Please select a valid building.',
          400,
          ERROR_CODES.VALIDATION_ERROR,
          { field: 'building', value: building },
        );
      }

      // Resolve unit_id logic:
      // 1. Verify provided unitId exists if present.
      // 2. If not present or invalid, look up by unitCode.
      // 3. If unit doesn't exist, auto-create it to ensure data integrity.

      let unitId = parsed.data.unitId;

      if (unitId) {
        // Verify specific unit exists and belongs to user
        const { count } = await supabase
          .from('units')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('id', unitId);

        if (!count) {
          console.warn(`Provided unitId ${unitId} invalid or not found. Falling back to unitCode.`);
          unitId = undefined;
        }
      }

      if (!unitId && parsed.data.unitCode) {
        // Try to resolve unit_id from unitCode
        const { data: unit } = await supabase
          .from('units')
          .select('id')
          .eq('user_id', userId)
          .eq('code', parsed.data.unitCode)
          .maybeSingle();

        if (unit) {
          unitId = unit.id;
        } else {
          // Auto-create the unit if it doesn't exist
          // This ensures strict referential integrity without blocking the user
          console.warn(`Auto-creating unit for code: ${parsed.data.unitCode}`);
          const { data: newUnit, error: createError } = await supabase
            .from('units')
            .insert({
              user_id: userId,
              code: parsed.data.unitCode,
              name: parsed.data.unitCode, // Default name
              color: '#3B82F6', // Default color
            })
            .select('id')
            .single();

          if (newUnit) {
            unitId = newUnit.id;
          } else {
            logger.error('Failed to auto-create unit:', createError);
            // One last try: maybe it was created concurrently?
            const { data: retryUnit } = await supabase
              .from('units')
              .select('id')
              .eq('user_id', userId)
              .eq('code', parsed.data.unitCode)
              .maybeSingle();
            if (retryUnit) unitId = retryUnit.id;
          }
        }
      }

      const payload = {
        ...parsed.data,
        id: parsed.data.id ?? crypto.randomUUID(),
        user_id: userId, // Security: Associate deadline with current user
        unitId,
        createdAt: parsed.data.createdAt ?? new Date(),
      };

      const { data, error } = await supabase
        .from('deadlines')
        .insert(serializeDeadline(payload))
        .select('*')
        .single();

      if (error) {
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error creating deadline:', error.code, error.message, error.details);
        return jsonError('Failed to create deadline', 500, ERROR_CODES.DATABASE_ERROR);
      }

      return NextResponse.json(mapDeadlineRow(data));
    } catch (error) {
      logger.error('Deadlines POST error:', error);
      return jsonError('Internal server error', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
