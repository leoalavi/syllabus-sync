import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, jsonSuccess, ERROR_CODES } from '@/app/api/_lib/response';
import { mapUnitRow } from '@/app/api/_lib/mappers';
import { requireAuthWithRateLimit, parseJsonBody } from '@/app/api/_lib/middleware';
import { logger } from '@/lib/logger';
import { isValidBuilding } from '@/lib/utils/buildingValidation';

// Helper to generate UUID v4 - with fallback for environments where crypto.randomUUID() is not available
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// More permissive UUID validation - accepts any valid UUID format
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to check if ID is valid (UUID or other formats for legacy data)
function isValidId(id: string): boolean {
  if (!id || id.trim() === '') return false;
  if (UUID_REGEX.test(id)) return true;
  if (/^\d+$/.test(id)) return true;
  if (/^[a-zA-Z0-9_-]+$/.test(id)) return true;
  return false;
}

const daySchema = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);
const classTimeSchema = z.object({
  id: z.string().min(1),
  day: daySchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});
// Note: createdAt is intentionally NOT included in update schema - it should not be updated
const unitUpdateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  notificationEnabled: z.boolean().optional(),
  location: z
    .object({
      building: z.string().default(''),
      room: z.string().default(''),
    })
    .optional(),
  schedule: z.array(classTimeSchema).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // SECURITY: Use rate-limited auth for mutation endpoint
  return requireAuthWithRateLimit(request, async (userId) => {
    let id: string | undefined;
    try {
      const { id: paramId } = await params;
      id = paramId;

      // Validate ID format
      if (!isValidId(id)) {
        console.warn('Invalid unit ID received for PUT:', id);
        return jsonError('Invalid unit ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      // SECURITY: Parse with size limit protection
      const bodyResult = await parseJsonBody(request);
      if (!bodyResult.success) {
        return jsonError(bodyResult.error, bodyResult.status, ERROR_CODES.VALIDATION_ERROR);
      }
      const parsed = unitUpdateSchema.safeParse(bodyResult.data);

      if (!parsed.success) {
        return jsonError('Invalid unit payload.', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      // VALIDATION: Check building against the 118 supported buildings
      const building = parsed.data.location?.building;
      if (building && building.trim() !== '' && !isValidBuilding(building)) {
        return jsonError(
          'Building not found in the campus list. Please select a valid building.',
          400,
          ERROR_CODES.VALIDATION_ERROR,
          { field: 'location.building', value: building },
        );
      }

      const supabase = await createServerClient();

      // SECURITY: Verify ownership BEFORE any mutations
      // This ensures we don't attempt to modify class_times for non-existent/unauthorized units
      // which would cause RLS violations during INSERT
      const { data: existingUnit, error: checkError } = await supabase
        .from('units')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (checkError || !existingUnit) {
        if (checkError?.code === 'PGRST116' || !existingUnit) {
          return jsonError('Unit not found', 404, ERROR_CODES.NOT_FOUND);
        }
        logger.error('Error verifying unit ownership:', checkError);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      // Destructure to handle special fields - schedule is stored in class_times table, not units
      const { location, schedule, notificationEnabled, ...rest } = parsed.data;

      const updatePayload: Record<string, unknown> = {
        ...rest,
      };

      // Map notificationEnabled to snake_case column
      if (notificationEnabled !== undefined) {
        updatePayload.notification_enabled = notificationEnabled;
      }

      // Map location object to JSONB column (not flat columns)
      if (location) {
        updatePayload.location = {
          building: location.building ?? '',
          room: location.room ?? '',
        };
      }

      // Handle schedule updates (stored in separate class_times table)
      if (schedule && schedule.length >= 0) {
        // Delete existing class times for this unit
        const { error: deleteError } = await supabase
          .from('class_times')
          .delete()
          .eq('unit_id', id);

        if (deleteError) {
          logger.error('Error deleting class times:', {
            code: deleteError.code,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
            unitId: id,
            userId: userId,
          });
          return jsonError(
            'Database operation failed: unable to update class schedule',
            500,
            ERROR_CODES.DATABASE_ERROR,
          );
        }

        // Insert new class times if any
        if (schedule.length > 0) {
          const classTimesPayload = schedule.map((ct) => ({
            id: ct.id && UUID_REGEX.test(ct.id) ? ct.id : generateUUID(),
            unit_id: id,
            day: ct.day,
            start_time: ct.startTime,
            end_time: ct.endTime,
          }));

          const { error: insertError } = await supabase
            .from('class_times')
            .insert(classTimesPayload);

          if (insertError) {
            logger.error('Error inserting class times:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
              unitId: id,
              userId: userId,
              payload: classTimesPayload,
            });
            return jsonError(
              'Database operation failed: unable to save class schedule',
              500,
              ERROR_CODES.DATABASE_ERROR,
            );
          }
        }
      }

      // If payload is empty (e.g. only schedule updated), fetch current unit to return it
      if (Object.keys(updatePayload).length === 0) {
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return jsonError('Unit not found', 404, ERROR_CODES.NOT_FOUND);
          }
          logger.error('Database error fetching unit after update:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            unitId: id,
            userId: userId,
          });
          return jsonError(
            'Database operation failed: unable to retrieve updated unit',
            500,
            ERROR_CODES.DATABASE_ERROR,
          );
        }

        // Fetch class times for this unit
        const { data: classTimesData } = await supabase
          .from('class_times')
          .select('*')
          .eq('unit_id', id);

        const unitSchedule = (classTimesData ?? []).map((ct: Record<string, unknown>) => ({
          id: String(ct.id),
          day: String(ct.day) as
            | 'Monday'
            | 'Tuesday'
            | 'Wednesday'
            | 'Thursday'
            | 'Friday'
            | 'Saturday'
            | 'Sunday',
          startTime: String(ct.start_time),
          endTime: String(ct.end_time),
        }));

        return jsonSuccess({
          ...mapUnitRow(data),
          schedule: unitSchedule,
        });
      }

      const { data, error } = await supabase
        .from('units')
        .update(updatePayload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error updating unit:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          unitId: id,
          userId: userId,
          payload: updatePayload,
        });
        if (error.code === 'PGRST116') {
          return jsonError('Unit not found', 404, ERROR_CODES.NOT_FOUND);
        }
        if (error.code === '23505') {
          return jsonError('Unit code already exists', 409, ERROR_CODES.CONFLICT);
        }
        return jsonError(
          'Database operation failed: unable to update unit',
          500,
          ERROR_CODES.DATABASE_ERROR,
        );
      }

      // Fetch class times for this unit
      const { data: classTimesData } = await supabase
        .from('class_times')
        .select('*')
        .eq('unit_id', id);

      const unitSchedule = (classTimesData ?? []).map((ct: Record<string, unknown>) => ({
        id: String(ct.id),
        day: String(ct.day) as
          | 'Monday'
          | 'Tuesday'
          | 'Wednesday'
          | 'Thursday'
          | 'Friday'
          | 'Saturday'
          | 'Sunday',
        startTime: String(ct.start_time),
        endTime: String(ct.end_time),
      }));

      return jsonSuccess({
        ...mapUnitRow(data),
        schedule: unitSchedule,
      });
    } catch (error) {
      logger.error('Error updating unit:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        unitId: id,
        userId: userId,
      });
      return jsonError('Failed to update unit', 500, ERROR_CODES.INTERNAL_ERROR);
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
        console.warn('Invalid unit ID received for DELETE:', id);
        return jsonError('Invalid unit ID format', 400, ERROR_CODES.BAD_REQUEST);
      }

      const supabase = await createServerClient();

      // First, get the unit to find its code (for cascade delete of deadlines)
      const { data: unitData, error: fetchError } = await supabase
        .from('units')
        .select('id, code')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError || !unitData) {
        if (fetchError?.code === 'PGRST116' || !unitData) {
          return jsonError('Unit not found', 404, ERROR_CODES.NOT_FOUND);
        }
        logger.error('Error fetching unit for delete:', fetchError);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      // CASCADE DELETE: Hard-delete all deadlines that reference this unit
      // This includes both unit_id FK and unit_code soft reference
      const { error: cascadeError } = await supabase
        .from('deadlines')
        .delete()
        .eq('user_id', userId)
        .or(`unit_id.eq.${id},unit_code.eq.${unitData.code}`);

      if (cascadeError) {
        logger.error('Error cascade deleting deadlines:', cascadeError);
        // Continue with unit deletion even if cascade fails
        // The deadlines will be orphaned but can be cleaned up later
      }

      // Delete class_times first (they have FK to units)
      const { error: classTimesError } = await supabase
        .from('class_times')
        .delete()
        .eq('unit_id', id);

      if (classTimesError) {
        logger.error('Error deleting class_times:', classTimesError);
        // Continue - the FK cascade should handle this anyway
      }

      // HARD DELETE: Actually remove the unit from database
      // This allows the user to re-add a unit with the same code later
      const { error } = await supabase.from('units').delete().eq('id', id).eq('user_id', userId);

      if (error) {
        // SECURITY: Log actual error server-side, return generic message to client
        logger.error('Database error deleting unit:', error.code, error.message);
        return jsonError('Database operation failed', 500, ERROR_CODES.DATABASE_ERROR);
      }

      // Return deleted unit id and code so client can cascade delete locally
      return jsonSuccess({ id, code: unitData.code, cascadeDeleted: true });
    } catch (error) {
      logger.error('Error deleting unit:', error);
      return jsonError('Failed to delete unit', 500, ERROR_CODES.INTERNAL_ERROR);
    }
  });
}
