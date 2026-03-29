import React from "react";
import { ConfirmModal } from "./ConfirmModal";

export function ResultsImportConfirmDialog({
  open,
  filename,
  compact,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  filename: string;
  compact?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const subtitle = compact
    ? `هل تريد استبدال بيانات الجدول الشامل؟\nالملف: ${filename || "—"}\n(سيتم تفريغ الجدول الشامل وتعبئته ببيانات Excel)`
    : `هل تريد استبدال بيانات الجدول الشامل مباشرة؟\nالملف: ${filename || "—"}\n(سيتم تفريغ الجدول الشامل وتعبئته ببيانات Excel)\n\nملاحظة: أي مهام في الجمعة/السبت سيتم نقلها تلقائيًا إلى الأحد.`;

  return (
    <ConfirmModal
      title="استبدال بيانات الجدول الشامل"
      subtitle={subtitle}
      confirmText="نعم"
      cancelText="اغلاق"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
