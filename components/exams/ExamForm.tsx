// components/exams/ExamForm.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDeadlinesStore } from '@/lib/store/deadlinesStore';
import { useUnitsStore } from '@/lib/store/unitsStore';
import { Deadline } from '@/lib/types';
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
import { Input } from '@/components/ui/mq/input';
import { toastUtils } from '@/lib/utils/toast';
import { useRetry } from '@/lib/hooks/use-retry';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRIORITY_LEVELS } from '@/lib/constants';
import { format, isValid } from 'date-fns';
import { errorHandler, createFormValidator, validationRules } from '@/lib/utils/errorHandling';
import { UNIT_COLORS } from '@/lib/config';
import { validateBuildingStrict, BUILDING_VALIDATION_ERROR } from '@/lib/utils/buildingValidation';
import { cn } from '@/lib/utils';
import BuildingAutocomplete from '@/components/ui/BuildingAutocomplete';

interface ExamFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExam?: Deadline | null;
}

export default function ExamForm({ open, onOpenChange, editExam }: ExamFormProps) {
  const { t } = useTypedTranslation();
  const { addDeadline, updateDeadline, removeDeadline } = useDeadlinesStore();
  const units = useUnitsStore((state) => state.units);

  const [title, setTitle] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState(''); // Optional room field
  const [color, setColor] = useState<string>(''); // Empty means inherit from unit
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00'); // Exams typically start in the morning
  const [priority, setPriority] = useState<Deadline['priority']>('High'); // Exams are usually high priority
  const [completed, setCompleted] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get selected unit for reference
  const selectedUnit = useMemo(() => {
    return units.find((u) => u.code === unitCode);
  }, [units, unitCode]);

  // Effective color: custom color if set, otherwise unit color
  const effectiveColor = useMemo(() => {
    if (useCustomColor && color) return color;
    return selectedUnit?.color || UNIT_COLORS[0].value;
  }, [useCustomColor, color, selectedUnit]);

  // Save operation with retry logic
  const performSave = useCallback(
    async (examData: Deadline) => {
      if (editExam) {
        return await updateDeadline(editExam.id, examData);
      } else {
        return await addDeadline(examData);
      }
    },
    [editExam, updateDeadline, addDeadline],
  );

  const { execute: saveWithRetry } = useRetry(performSave, {
    maxAttempts: 3,
    showToastOnError: false,
    errorMessage: t('failedToSaveDeadline'),
  });

  const resetForm = () => {
    setTitle('');
    setUnitCode('');
    setBuilding('');
    setRoom('');
    setColor('');
    setUseCustomColor(false);
    setDueDate('');
    setDueTime('09:00');
    setPriority('High');
    setCompleted(false);
    setErrors({});
  };

  useEffect(() => {
    if (editExam) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(editExam.title);
      setUnitCode(editExam.unitCode);
      setBuilding(editExam.building || '');
      setRoom(editExam.room || ''); // Load optional room
      // If exam has a custom color, use it; otherwise inherit from unit
      if (editExam.color) {
        setColor(editExam.color);
        setUseCustomColor(true);
      } else {
        setColor('');
        setUseCustomColor(false);
      }
      const parsedDate = new Date(editExam.dueDate);
      if (isValid(parsedDate)) {
        setDueDate(format(parsedDate, 'yyyy-MM-dd'));
        setDueTime(format(parsedDate, 'HH:mm'));
      } else {
        setDueDate('');
        setDueTime('09:00');
      }
      setPriority(editExam.priority);
      setCompleted(editExam.completed);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editExam?.id, open]);

  const validateForm = (): boolean => {
    const validator = createFormValidator({
      title: validationRules.required(t('title')),
      unitCode: validationRules.required(t('unit')),
      dueDate: validationRules.required(t('dueDate')),
      dueTime: validationRules.required(t('time' as TranslationKey)),
      building: (value) => {
        const requiredError = validationRules.required(t('building' as TranslationKey))(value);
        if (requiredError) return requiredError;
        // Validate building strictly against map data - exact match only
        const validatedBuilding = validateBuildingStrict(value as string);
        if (!validatedBuilding) {
          return BUILDING_VALIDATION_ERROR;
        }
        return null;
      },
    });

    const validationErrors = validator({
      title,
      unitCode,
      dueDate,
      dueTime,
      building,
    });
    const formErrors = errorHandler.handleValidationError(validationErrors);

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);

    const [year, month, day] = dueDate.split('-').map(Number);
    const timeParts = dueTime ? dueTime.split(':') : [];
    const parsedHours = Number(timeParts[0]);
    const parsedMinutes = Number(timeParts[1]);
    const hasValidTime =
      timeParts.length === 2 && !Number.isNaN(parsedHours) && !Number.isNaN(parsedMinutes);
    const dueDateObj = new Date(
      year,
      month - 1,
      day,
      hasValidTime ? parsedHours : 9,
      hasValidTime ? parsedMinutes : 0,
    );

    const examData: Deadline = {
      id: editExam?.id || uuidv4(),
      title: title.trim(),
      unitCode,
      unitId: selectedUnit?.id,
      building: building.trim(),
      room: room.trim() || undefined, // Optional room field
      color: useCustomColor ? color : undefined, // Only save custom color
      dueDate: dueDateObj,
      priority,
      type: 'Exam', // Fixed type for exams
      completed,
      createdAt: editExam?.createdAt || new Date(),
    };

    try {
      const result = await saveWithRetry(examData);
      if (result !== null) {
        if (editExam) {
          toastUtils.success(
            t('examUpdated' as TranslationKey),
            t('examUpdatedDesc' as TranslationKey, { title: examData.title }),
          );
        } else {
          toastUtils.success(
            t('examAdded' as TranslationKey),
            t('examAddedDesc' as TranslationKey, { title: examData.title }),
          );
        }
        onOpenChange(false);
        resetForm();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (editExam) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (editExam) {
      removeDeadline(editExam.id);
      toastUtils.success(
        t('examDeleted' as TranslationKey),
        t('examDeletedDesc' as TranslationKey, { title: editExam.title }),
      );
      onOpenChange(false);
      resetForm();
    }
    setShowDeleteConfirm(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editExam ? t('editExam' as TranslationKey) : t('addExam' as TranslationKey)}
            </DialogTitle>
            <DialogDescription>
              {editExam
                ? t('updateExamDetails' as TranslationKey)
                : t('fillExamDetails' as TranslationKey)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-1 sm:py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="exam-title">
                {t('title')} <span className="text-mq-error">*</span>
              </Label>
              <Input
                id="exam-title"
                placeholder={t('examTitlePlaceholder' as TranslationKey)}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={Boolean(errors.title)}
                aria-required="true"
                aria-describedby={errors.title ? 'exam-title-error' : undefined}
                className={errors.title ? 'border-mq-error' : ''}
              />
              {errors.title && (
                <p id="exam-title-error" className="text-sm text-mq-error" role="alert">
                  {errors.title}
                </p>
              )}
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label htmlFor="exam-unit">
                {t('unitCode')} <span className="text-mq-error">*</span>
              </Label>
              <Select value={unitCode} onValueChange={setUnitCode}>
                <SelectTrigger
                  id="exam-unit"
                  className={errors.unitCode ? 'border-mq-error' : ''}
                  aria-invalid={Boolean(errors.unitCode)}
                  aria-required="true"
                  aria-describedby={errors.unitCode ? 'exam-unit-error' : undefined}
                >
                  <SelectValue placeholder={t('selectUnit')} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.code}>
                      {unit.code} - {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unitCode && (
                <p id="exam-unit-error" className="text-sm text-mq-error" role="alert">
                  {errors.unitCode}
                </p>
              )}
            </div>

            {/* Building and Room */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exam-building">
                  {t('building' as TranslationKey)} <span className="text-mq-error">*</span>
                </Label>
                <BuildingAutocomplete
                  value={building}
                  onChange={setBuilding}
                  error={errors.building}
                  required
                  placeholder={t('buildingPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-room">{t('room' as TranslationKey)}</Label>
                <Input
                  id="exam-room"
                  placeholder={t('roomPlaceholder')}
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                />
                <p className="text-xs text-mq-content-tertiary">{t('optional')}</p>
              </div>
            </div>

            {/* Exam Date and Time */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exam-date">
                  {t('examDate' as TranslationKey)} <span className="text-mq-error">*</span>
                </Label>
                <Input
                  id="exam-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-invalid={Boolean(errors.dueDate)}
                  aria-required="true"
                  aria-describedby={errors.dueDate ? 'exam-date-error' : undefined}
                  className={errors.dueDate ? 'border-mq-error' : ''}
                />
                {errors.dueDate && (
                  <p id="exam-date-error" className="text-sm text-mq-error" role="alert">
                    {errors.dueDate}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-time">
                  {t('examTime' as TranslationKey)} <span className="text-mq-error">*</span>
                </Label>
                <Input
                  id="exam-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  aria-invalid={Boolean(errors.dueTime)}
                  aria-required="true"
                  className={errors.dueTime ? 'border-mq-error' : ''}
                />
                {errors.dueTime && (
                  <p className="text-sm text-mq-error" role="alert">
                    {errors.dueTime}
                  </p>
                )}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="exam-priority">{t('priority')}</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Deadline['priority'])}
              >
                <SelectTrigger id="exam-priority">
                  <SelectValue placeholder={t('selectPriority')} />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_LEVELS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`priority_${p}` as TranslationKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color Selection */}
            <div className="space-y-2">
              <Label>{t('color' as TranslationKey)}</Label>

              {/* Unit Color Inheritance Toggle */}
              <div className="flex items-center gap-3 p-2 rounded-lg border border-mq-border bg-mq-surface/50">
                <div
                  className="w-6 h-6 rounded-full border-2 border-mq-border shrink-0"
                  style={{ backgroundColor: effectiveColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-mq-content">
                    {useCustomColor
                      ? t('colorCustom' as TranslationKey)
                      : t('colorInheritsUnit' as TranslationKey)}
                  </p>
                  <p className="text-xs text-mq-content-secondary truncate">
                    {useCustomColor
                      ? UNIT_COLORS.find((c) => c.value === color)?.name || color
                      : selectedUnit
                        ? t('colorFromUnit' as TranslationKey, { code: selectedUnit.code })
                        : t('colorSelectUnitFirst' as TranslationKey)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!useCustomColor) {
                      setColor(selectedUnit?.color || UNIT_COLORS[0].value);
                    }
                    setUseCustomColor(!useCustomColor);
                  }}
                  className="text-xs px-2 py-1 rounded border border-mq-border hover:bg-mq-hover-background transition-colors"
                >
                  {useCustomColor
                    ? t('colorUseUnit' as TranslationKey)
                    : t('colorCustomize' as TranslationKey)}
                </button>
              </div>

              {/* Custom Color Picker - Scrollable */}
              {useCustomColor && (
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
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {editExam && (
              <Button variant="destructive" onClick={handleDelete}>
                {t('delete')}
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={units.length === 0 || isSaving}>
              {isSaving
                ? t('savingChanges' as TranslationKey)
                : editExam
                  ? t('saveChanges')
                  : t('addExam' as TranslationKey)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('deleteExam' as TranslationKey)}</DialogTitle>
            <DialogDescription>{t('deleteExamConfirm' as TranslationKey)}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
