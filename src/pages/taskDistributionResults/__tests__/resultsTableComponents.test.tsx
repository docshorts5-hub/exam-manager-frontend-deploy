import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsTable } from '../components/ResultsTable';

vi.mock('../components/TeacherRow', () => ({
  TeacherRow: ({ teacher }: { teacher: string }) => <tr data-testid="teacher-row"><td>{teacher}</td></tr>,
}));

vi.mock('../components/ResultsTableHeader', () => ({
  ResultsTableHeader: () => <thead data-testid="results-header"><tr><th>header</th></tr></thead>,
}));

vi.mock('../components/ResultsTotalsRow', () => ({
  ResultsTotalsRow: () => <tr data-testid="results-totals"><td>totals</td></tr>,
}));

function buildProps(overrides: Partial<React.ComponentProps<typeof ResultsTable>> = {}): React.ComponentProps<typeof ResultsTable> {
  return {
    displayDates: ['2026-01-01'],
    dateToSubCols: new Map([['2026-01-01', [{ key: 'k1', dateISO: '2026-01-01', period: 'AM', subject: 'Math' } as any]]]),
    allSubCols: [{ key: 'k1', dateISO: '2026-01-01', period: 'AM', subject: 'Math' } as any],
    allTeachers: ['أحمد', 'سارة'],
    matrix2: {},
    committeesCountBySubCol: { k1: 2 },
    totalsDetailBySubCol: { k1: { inv: 1, res: 0, corr: 0, total: 1, deficit: 0, committees: 2, required: 1 } },
    teacherTotals: { أحمد: 1 },
    columnColor: () => ({ colBg: '#111', headBg: '#222' }),
    teacherRowColor: () => ({ stripe: '#333' }),
    getSubjectBackground: () => '#444',
    taskLabel: () => 'مراقبة',
    normalizeSubject: (s: string) => s,
    formatPeriod: (p?: string) => p || 'AM',
    getCommitteeNo: () => '1',
    isDraggableTaskType: () => true,
    dragSrcUid: null,
    dragOverUid: null,
    setDragSrcUid: () => {},
    setDragOverUid: () => {},
    onSwap: () => {},
    onDropToEmpty: () => {},
    styles: {
      tableText: '#fff',
      tableFontSize: '14px',
      goldLine: '#d4af37',
      goldLineSoft: 'rgba(212,175,55,0.4)',
      teacherHeaderStyle: {},
      teacherTotalHeaderStyle: {},
    },
    formatDateWithDayAr: () => ({ day: 'الخميس', full: 'الخميس 2026-01-01', line: 'الخميس\n2026-01-01' }),
    ...overrides,
  } as React.ComponentProps<typeof ResultsTable>;
}

describe('ResultsTable', () => {
  it('renders header, teacher rows, and totals row', () => {
    render(<ResultsTable {...buildProps()} />);
    expect(screen.getByTestId('results-header')).toBeTruthy();
    expect(screen.getAllByTestId('teacher-row')).toHaveLength(2);
    expect(screen.getByTestId('results-totals')).toBeTruthy();
  });

  it('uses default max height and injects conflict animation css', () => {
    const { container } = render(<ResultsTable {...buildProps()} />);
    const shell = container.querySelector('div');
    expect(shell?.getAttribute('style') || '').toContain('max-height: 72vh');
    expect(container.textContent).toContain('أحمد');
    const styleTag = container.querySelector('style');
    expect(styleTag?.textContent || '').toContain('conflictPulse');
  });

  it('respects custom container max height', () => {
    const { container } = render(<ResultsTable {...buildProps({ containerMaxHeight: '90vh' })} />);
    const shell = container.querySelector('div');
    expect(shell?.getAttribute('style') || '').toContain('max-height: 90vh');
  });
});
