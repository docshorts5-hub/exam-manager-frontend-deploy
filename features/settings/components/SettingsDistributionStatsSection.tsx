import React from 'react';
import SettingsEmptyStateCard from './SettingsEmptyStateCard';

type ReportRow = Record<string, any>;

type Totals = {
  committees: number;
  inv: number;
  reserve: number;
  deficit: number;
  total: number;
  requiredTotal: number;
};

type Props = {
  hasAssignments: boolean;
  isStatsFull: boolean;
  totalDeficit: number;
  totalCoveragePct: number;
  reportRows: ReportRow[];
  totals: Totals;
  bigDeficitThreshold: number;
  whatsappAdminKey: string;
  onCloseFullscreen: () => void;
};

export default function SettingsDistributionStatsSection({
  hasAssignments,
  isStatsFull,
  totalDeficit,
  totalCoveragePct,
  reportRows,
  totals,
  bigDeficitThreshold,
  whatsappAdminKey,
  onCloseFullscreen,
}: Props) {
  if (!hasAssignments) {
    return <SettingsEmptyStateCard message="لا يوجد توزيع محفوظ حاليًا (لم يتم العثور على بيانات في Run أو الجدول الشامل)." />;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div
        className="no-print"
        style={{
          margin: '10px 0 12px',
          padding: '10px 12px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(0,0,0,0.20)',
          color: 'rgba(255,255,255,0.92)',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>ملخص سريع</div>
        <div>
          إجمالي العجز الكلي: <span style={{ color: totalDeficit > 0 ? '#ff4d4d' : 'rgba(255,255,255,0.92)' }}>{totalDeficit}</span>
        </div>
        <div>
          نسبة التغطية:{' '}
          <span style={{ color: totalCoveragePct < 100 ? '#ffd166' : 'rgba(255,255,255,0.92)' }}>{totalCoveragePct}%</span>
        </div>
      </div>

      <div
        style={
          isStatsFull
            ? {
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: '#07121f',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
              }
            : { overflowX: 'auto' }
        }
      >
        {isStatsFull && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.08)',
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 900, color: 'rgba(255,255,255,0.95)' }}>تقرير إحصائية التوزيع</div>
            <button
              onClick={onCloseFullscreen}
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.95)',
                fontWeight: 900,
              }}
            >
              إغلاق
            </button>
          </div>
        )}

        <div style={isStatsFull ? { flex: 1, overflow: 'auto' } : undefined}>
          <div id="dist-stats-report" className="distStats3D">
            <table className="distTable">
              <thead>
                <tr>
                  {[
                    'التاريخ',
                    'اليوم',
                    'المادة',
                    'الفترة',
                    'عدد القاعات',
                    'مراقبين/قاعة',
                    'المطلوب',
                    'عدد المراقبين',
                    'عدد الاحتياط',
                    'التغطية %',
                    'العجز',
                    'عجز بدون احتياط',
                    'المجموع (م+ا)',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        border: '1px solid rgba(255,255,255,0.16)',
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.10)',
                        color: 'rgba(255,255,255,0.98)',
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {reportRows.map((r) => {
                  const isDef = (Number(r.deficit) || 0) > 0;
                  const isBig = (Number(r.deficit) || 0) >= bigDeficitThreshold;

                  return (
                    <tr key={String(r.id) + String(r.dateISO) + String(r.period)} className={`${isDef ? 'row-deficit' : ''} ${isBig ? 'row-big-deficit' : ''}`.trim()}>
                      <td className={'distTd distColDate'}>{r.dateISO}</td>
                      <td className={'distTd distColDate'}>{r.day || '—'}</td>
                      <td className="distTd distColSubject" style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '8px 10px', fontWeight: 800 }}>
                        {r.subject}
                      </td>
                      <td className={'distTd distColDate'}>{r.periodLabel}</td>
                      <td className={'distTd'}>{r.roomsCount || 0}</td>
                      <td className={'distTd'}>{r.invPerRoom}</td>
                      <td className={'distTd'} style={{ fontWeight: 950 }}>{r.requiredTotal}</td>
                      <td className={'distTd'}>{r.invAssigned}</td>
                      <td className={'distTd'}>{r.reserveAssigned}</td>
                      <td className={'distTd'} style={{ fontWeight: 950, color: (Number(r.coveragePct) || 0) < 100 ? '#ffd166' : '#bbf7d0' }}>
                        {r.coveragePct}%
                      </td>
                      <td className="distTd" style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>
                        {r.deficit}
                      </td>
                      <td className={'distTd'} style={{ color: (Number(r.deficitWithoutReserve) || 0) > 0 ? '#fecaca' : '#bbf7d0', fontWeight: 950 }}>
                        {r.deficitWithoutReserve}
                      </td>
                      <td className={'distTd'}>{r.total}</td>
                    </tr>
                  );
                })}

                <tr>
                  <td
                    colSpan={4}
                    style={{
                      border: '1px solid rgba(255,255,255,0.16)',
                      padding: '10px',
                      textAlign: 'left',
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <b>الإجمالي</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>{totals.committees}</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>—</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>{totals.requiredTotal}</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>{totals.inv}</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>{totals.reserve}</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)', fontWeight: 950 }}>
                    <b>{totalCoveragePct}%</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>{totals.deficit}</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>—</b>
                  </td>
                  <td className={'distTd'} style={{ border: '1px solid rgba(255,255,255,0.16)', padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.06)' }}>
                    <b>{totals.total}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.85, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
        ملاحظة: العجز محسوب حسب المعادلة: (عدد القاعات × مراقبين/قاعة من الإعدادات) − (المراقبة + الاحتياط).
        <br />
        تنبيه واتساب: ضع رقم المسؤول في LocalStorage key: <b>{whatsappAdminKey}</b>
      </div>
    </div>
  );
}
