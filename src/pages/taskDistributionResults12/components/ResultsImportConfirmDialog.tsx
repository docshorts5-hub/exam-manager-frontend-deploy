import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
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
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  if (!open) return null;

  const subtitle = compact
    ? `${tr("هل تريد استبدال بيانات الجدول الشامل؟", "Do you want to replace the master table data?")}\n${tr("الملف", "File")}: ${filename || "—"}\n${tr("(سيتم تفريغ الجدول الشامل وتعبئته ببيانات Excel)", "(The master table will be cleared and filled with Excel data)")}`
    : `${tr("هل تريد استبدال بيانات الجدول الشامل مباشرة؟", "Do you want to replace the master table data directly?")}\n${tr("الملف", "File")}: ${filename || "—"}\n${tr("(سيتم تفريغ الجدول الشامل وتعبئته ببيانات Excel)", "(The master table will be cleared and filled with Excel data)")}\n\n${tr("ملاحظة: أي مهام في الجمعة/السبت سيتم نقلها تلقائيًا إلى الأحد.", "Note: Any tasks on Friday/Saturday will be moved automatically to Sunday.")}`;

  return (
    <ConfirmModal
      title={tr("استبدال بيانات الجدول الشامل", "Replace Master Table Data")}
      subtitle={subtitle}
      confirmText={tr("نعم", "Yes")}
      cancelText={tr("اغلاق", "Close")}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
