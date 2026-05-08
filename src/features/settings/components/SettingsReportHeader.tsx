import React from 'react';
import { useI18n } from "../../../i18n/I18nProvider";

type Props = {
  logo?: string;
  appName: string;
  sourceLabel: string;
  totalDeficit: number;
  sortDir: 'asc' | 'desc';
  isStatsFull: boolean;
  lastRunLabel?: string | null;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onExportPdf: () => void;
  onToggleFullscreen: () => void;
};

export default function SettingsReportHeader({
  logo,
  appName,
  sourceLabel,
  totalDeficit,
  sortDir,
  isStatsFull,
  lastRunLabel,
  onSortAsc,
  onSortDesc,
  onExportPdf,
  onToggleFullscreen,
}: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.88) 55%, rgba(0,0,0,0.82) 100%)',
        boxShadow:
          '0 10px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -8px 18px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        color: 'rgba(255,255,255,0.95)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          {logo ? (
            <img src={logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontWeight: 900, opacity: 0.8 }}>★</span>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.2,
              color: '#d4af37',
              textShadow: '0 1px 0 rgba(0,0,0,0.6), 0 0 10px rgba(212,175,55,0.25)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {appName}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.92)' }}>
            {tr('تقرير إحصائية التوزيع', 'Distribution Statistics Report')}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.78)' }}>
            {tr('مصدر البيانات', 'Data Source')}: {sourceLabel}
          </div>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.92)',
            fontSize: 12,
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          {tr('إجمالي العجز', 'Total Deficit')}: <span style={{ color: totalDeficit > 0 ? '#ff4d4d' : 'rgba(255,255,255,0.92)' }}>{totalDeficit}</span>
        </div>

        <button
          onClick={onSortAsc}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: sortDir === 'asc' ? 'rgba(25,135,84,0.22)' : 'rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
          title={tr('ترتيب حسب التاريخ (الأقدم أولاً)', 'Sort by date (oldest first)')}
        >
          {tr('🔼 الأقدم أولاً', '🔼 Oldest First')}
        </button>

        <button
          onClick={onSortDesc}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: sortDir === 'desc' ? 'rgba(25,135,84,0.22)' : 'rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
          title={tr('ترتيب حسب التاريخ (الأحدث أولاً)', 'Sort by date (newest first)')}
        >
          {tr('🔽 الأحدث أولاً', '🔽 Newest First')}
        </button>

        <button
          onClick={onExportPdf}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(212,175,55,0.15)',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 900,
          }}
        >
          {tr('تصدير PDF', 'Export PDF')}
        </button>

        <button
          onClick={onToggleFullscreen}
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: isStatsFull ? 'rgba(25,135,84,0.22)' : 'rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.95)',
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          {isStatsFull ? tr('إغلاق ملء الشاشة', 'Close Fullscreen') : tr('ملء الشاشة', 'Fullscreen')}
        </button>

        <div style={{ textAlign: 'left', opacity: 0.85, fontSize: 12, whiteSpace: 'nowrap' }}>
          {lastRunLabel ? (
            <>
              {tr('آخر تشغيل', 'Last Run')}: <b>{lastRunLabel}</b>
            </>
          ) : (
            <>{tr('لا يوجد تشغيل محفوظ', 'No saved run')}</>
          )}
        </div>
      </div>
    </div>
  );
}
