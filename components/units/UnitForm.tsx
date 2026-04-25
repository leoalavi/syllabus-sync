'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUnitsStore } from '@/lib/store/unitsStore';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { Unit, ClassTime, DayOfWeek } from '@/lib/types';
import { UNIT_COLORS } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';
import { useTypedTranslation } from '@/lib/hooks/useTypedTranslation';
import type { TranslationKey } from '@/lib/i18n/translations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/mq/button';
import { errorHandler, createFormValidator, validationRules } from '@/lib/utils/errorHandling';
import { toastUtils } from '@/lib/utils/toast';
import { useRetry } from '@/lib/hooks/use-retry';
import { Input } from '@/components/ui/mq/input';
import { Label } from '@/components/ui/label';
import { validateBuildingStrict, BUILDING_VALIDATION_ERROR } from '@/lib/utils/buildingValidation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import BuildingAutocomplete from '@/components/ui/BuildingAutocomplete';
import UnitAutocomplete from '@/components/ui/UnitAutocomplete';

interface UnitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editUnit?: Unit | null;
}

const DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function UnitForm({ open, onOpenChange, editUnit }: UnitFormProps) {
  const { t } = useTypedTranslation();
  const { addUnit, updateUnit } = useUnitsStore();
  const removeDeadlinesByUnit = useDeadlinesStore((state) => state.removeDeadlinesByUnit);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState(''); // Optional room field
  const [color, setColor] = useState<string>(UNIT_COLORS[0].value);
  const [schedule, setSchedule] = useState<ClassTime[]>([]);

  // Errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Save operation with retry logic
  const performSave = useCallback(
    async (unitData: Unit) => {
      if (editUnit) {
        return await updateUnit(editUnit.id, unitData);
      } else {
        return await addUnit(unitData);
      }
    },
    [editUnit, updateUnit, addUnit],
  );

  const { execute: saveWithRetry, isLoading: isSaving } = useRetry(performSave, {
    maxAttempts: 3,
    showToastOnError: false, // We'll handle toasts manually
    errorMessage: t('failedToSaveUnit'),
  });

  const createDefaultClassTime = (): ClassTime => ({
    id: uuidv4(),
    day: 'Monday' as DayOfWeek,
    startTime: '09:00',
    endTime: '11:00',
  });

  const resetForm = () => {
    setCode('');
    setName('');
    setBuilding('');
    setRoom('');
    setColor(UNIT_COLORS[0].value);
    setSchedule([createDefaultClassTime()]);
    setErrors({});
  };

  // Initialize form with edit data
  useEffect(() => {
    if (editUnit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(editUnit.code);
      setName(editUnit.name);
      setBuilding(editUnit.location.building);
      setRoom(editUnit.location.room || '');
      setColor(editUnit.color);
      setSchedule([...editUnit.schedule]);
    } else {
      resetForm();
      // Ensure at least one class time is present for new units
      if (schedule.length === 0) {
        setSchedule([createDefaultClassTime()]);
      }
    }
    // Use editUnit?.id to avoid re-running when object reference changes but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUnit?.id, open]);

  const addClassTime = () => {
    const newClassTime: ClassTime = {
      id: uuidv4(),
      day: 'Monday',
      startTime: '09:00',
      endTime: '11:00',
    };
    setSchedule([...schedule, newClassTime]);
  };

  const removeClassTime = (id: string) => {
    setSchedule(schedule.filter((ct) => ct.id !== id));
  };

  const updateClassTime = (id: string, field: keyof ClassTime, value: string) => {
    setSchedule(schedule.map((ct) => (ct.id === id ? { ...ct, [field]: value } : ct)));
  };

  const validateForm = (): boolean => {
    const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const UNIT_CODE_REGEX = /^[A-Z]{2,6}\d{0,4}[A-Z]?$/;

    const validator = createFormValidator({
      code: (value) => {
        const requiredError = validationRules.required(t('unitCode'))(value);
        if (requiredError) return requiredError;

        const stringValue = String(value).trim().toUpperCase();
        if (!UNIT_CODE_REGEX.test(stringValue)) {
          return t('invalidUnitCodeFormat');
        }
        return null;
      },
      name: validationRules.required(t('unitName')),
      building: (value) => {
        const requiredError = validationRules.required(t('building'))(value);
        if (requiredError) return requiredError;
        // Validate building strictly against map data - exact match only
        const validatedBuilding = validateBuildingStrict(value as string);
        if (!validatedBuilding) {
          return BUILDING_VALIDATION_ERROR;
        }
        return null;
      },
      schedule: (scheduleValue) =>
        !scheduleValue || !Array.isArray(scheduleValue) || scheduleValue.length === 0
          ? t('atLeastOneClass')
          : null,
    });

    // Validate class times separately
    const classTimeErrors: Array<{ field: string; message: string }> = [];
    schedule.forEach((ct, index) => {
      // Check for missing or invalid time format
      const startTimeValid = ct.startTime && TIME_REGEX.test(ct.startTime);
      const endTimeValid = ct.endTime && TIME_REGEX.test(ct.endTime);

      if (!startTimeValid || !endTimeValid) {
        classTimeErrors.push({
          field: `time_${index}`,
          message: t('invalidTimeFormat'),
        });
        return;
      }

      // Check that end time is after start time
      if (ct.startTime >= ct.endTime) {
        classTimeErrors.push({
          field: `time_${index}`,
          message: t('endTimeAfterStart'),
        });
      }
    });

    // Check for duplicate class times
    const timesSet = new Set();
    schedule.forEach((ct, index) => {
      const timeKey = `${ct.day}-${ct.startTime}-${ct.endTime}`;
      if (timesSet.has(timeKey)) {
        classTimeErrors.push({
          field: `duplicate_${index}`,
          message: t('duplicateClassTime'),
        });
      }
      timesSet.add(timeKey);
    });

    const allValidationErrors = [
      ...validator({ code, name, building, schedule }),
      ...classTimeErrors,
    ];
    const formErrors = errorHandler.handleValidationError(allValidationErrors);

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const newCode = code.trim().toUpperCase();
    const unitData: Unit = {
      id: editUnit?.id || uuidv4(),
      code: newCode,
      name: name.trim(),
      color,
      location: {
        building: building.trim(),
        room: room.trim(), // Optional room field
      },
      schedule,
      createdAt: editUnit?.createdAt || new Date(),
    };

    // If editing and the unit code changed, remove deadlines associated with the old unit
    if (editUnit && editUnit.code.toUpperCase() !== newCode) {
      removeDeadlinesByUnit(editUnit.id, editUnit.code);
    }

    const result = await saveWithRetry(unitData);
    if (result !== null) {
      // Success - show toast and close form
      if (editUnit) {
        toastUtils.success(
          t('unitUpdated'),
          t('unitUpdatedDesc' as TranslationKey, { code: unitData.code, name: unitData.name }),
          { id: 'unit-updated-toast' },
        );
      } else {
        toastUtils.success(
          t('unitAdded'),
          t('unitAddedDesc' as TranslationKey, { code: unitData.code, name: unitData.name }),
          { id: 'unit-added-toast' },
        );
      }
      onOpenChange(false);
      resetForm();
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{editUnit ? t('editUnit') : t('addNewUnit')}</DialogTitle>
          <DialogDescription>
            {editUnit ? t('updateUnitDetails') : t('fillUnitDetails')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-1 sm:py-4 flex-1 overflow-y-auto min-h-0 pr-1">
          {/* MQ Unit Search - Combined Code and Name */}
          <div className="space-y-2">
            <Label>
              {t('unitCodeLabel')} & {t('unitNameLabel')} <span className="text-mq-error">*</span>
            </Label>
            <UnitAutocomplete
              codeValue={code}
              nameValue={name}
              onSelect={(selectedCode, selectedName) => {
                setCode(selectedCode);
                setName(selectedName);
              }}
              error={errors.code || errors.name}
              required
              allowCustom
            />
            <p id="unit-code-help" className="text-xs text-mq-content-tertiary">
              {t('unitCodeHelp')}
            </p>
          </div>

          {/* Location (Building and optional Room) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="building">
                {t('buildingLabel')} <span className="text-mq-error">*</span>
              </Label>
              <BuildingAutocomplete
                value={building}
                onChange={setBuilding}
                error={errors.building}
                required
                placeholder={t('buildingPlaceholder')}
              />
              <p id="unit-building-help" className="text-xs text-mq-content-tertiary">
                {t('buildingHelp')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="room">{t('roomLabel')}</Label>
              <Input
                id="room"
                placeholder={t('roomPlaceholder')}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
              <p className="text-xs text-mq-content-tertiary">{t('optional')}</p>
            </div>
          </div>

          {/* Color Selection - Scrollable */}
          <div className="space-y-2">
            <Label>{t('unitColor')}</Label>
            <div className="flex gap-2 overflow-x-auto pb-2 px-2 pt-2 scrollbar-thin scrollbar-thumb-mq-border">
              {UNIT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 shrink-0 transition-all',
                    color === c.value
                      ? 'border-mq-content ring-2 ring-offset-2 ring-mq-primary ring-inset'
                      : 'border-transparent hover:border-mq-border',
                  )}
                  style={{ backgroundColor: c.value }}
                  title={t(c.translationKey as TranslationKey)}
                  aria-label={t(c.translationKey as TranslationKey)}
                />
              ))}
            </div>
          </div>

          {/* Class Times */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                {t('classTimesLabel')} <span className="text-mq-error">*</span>
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addClassTime}>
                <Plus className="w-4 h-4 mr-1" />
                {t('addClassTime')}
              </Button>
            </div>

            {errors.schedule && schedule.length === 0 && (
              <p className="text-sm text-mq-error">{errors.schedule}</p>
            )}

            <div className="space-y-3">
              {schedule.map((ct, index) => {
                const hasTimeError = errors[`time_${index}`] || errors[`duplicate_${index}`];
                return (
                  <div
                    key={ct.id}
                    className={`p-3 border rounded-lg ${hasTimeError ? 'border-mq-error' : ''}`}
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row">
                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                        {/* Day */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t('day')}</Label>
                          <Select
                            value={ct.day}
                            onValueChange={(value) => updateClassTime(ct.id, 'day', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              sideOffset={4}
                              className="max-h-[280px]"
                            >
                              {DAYS.map((day) => (
                                <SelectItem key={day} value={day}>
                                  {t(day.toLowerCase() as TranslationKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Start Time */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t('start')}</Label>
                          <Input
                            type="time"
                            value={ct.startTime}
                            onChange={(e) => updateClassTime(ct.id, 'startTime', e.target.value)}
                            className={`h-9 ${hasTimeError ? 'border-mq-error' : ''}`}
                          />
                        </div>

                        {/* End Time */}
                        <div className="space-y-1">
                          <Label className="text-xs">{t('end')}</Label>
                          <Input
                            type="time"
                            value={ct.endTime}
                            onChange={(e) => updateClassTime(ct.id, 'endTime', e.target.value)}
                            className={`h-9 ${hasTimeError ? 'border-mq-error' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeClassTime(ct.id)}
                        className="mt-1 sm:mt-6"
                        aria-label={t('removeClassTime')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Errors for this class time - now properly below inputs */}
                    {hasTimeError && (
                      <p className="mt-2 text-xs text-mq-error" role="alert">
                        {errors[`time_${index}`] || errors[`duplicate_${index}`]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? t('saving') : editUnit ? t('update') : t('add')} {t('unit')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
