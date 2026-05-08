import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SyncStatusBanner from '../components/SyncStatusBanner';
import SyncEmptyState from '../components/SyncEmptyState';

describe('sync ui components', () => {
  const card = { border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 8 } as React.CSSProperties;

  it('renders warning banner message', () => {
    const html = renderToStaticMarkup(<SyncStatusBanner card={card} message="⚠️ Cloud Functions مطلوبة" />);
    expect(html).toContain('حالة العملية: تنبيه');
    expect(html).toContain('Cloud Functions مطلوبة');
  });

  it('renders sync empty state', () => {
    const html = renderToStaticMarkup(<SyncEmptyState message="لا توجد نسخ" />);
    expect(html).toContain('لا توجد نسخ');
  });
});
