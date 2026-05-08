import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SettingsReportHeader from '../components/SettingsReportHeader';
import SettingsEmptyStateCard from '../components/SettingsEmptyStateCard';

describe('settings ui components', () => {
  it('renders report header with key metadata', () => {
    const html = renderToStaticMarkup(
      <SettingsReportHeader
        logo=""
        appName="نظام الاختبارات"
        sourceLabel="آخر تشغيل"
        totalDeficit={3}
        sortDir="desc"
        isStatsFull={false}
        lastRunLabel="2026-03-06"
        onSortAsc={() => {}}
        onSortDesc={() => {}}
        onExportPdf={() => {}}
        onToggleFullscreen={() => {}}
      />,
    );

    expect(html).toContain('نظام الاختبارات');
    expect(html).toContain('إجمالي العجز');
    expect(html).toContain('2026-03-06');
  });

  it('renders empty state card message', () => {
    const html = renderToStaticMarkup(<SettingsEmptyStateCard message="لا توجد بيانات" />);
    expect(html).toContain('لا توجد بيانات');
  });
});
