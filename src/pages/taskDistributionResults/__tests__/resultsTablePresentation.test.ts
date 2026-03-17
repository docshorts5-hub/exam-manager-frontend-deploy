import { describe, expect, it } from 'vitest';
import { getResultsTableContainerStyle, RESULTS_TABLE_CONFLICT_CSS } from '../services/resultsTablePresentation';

describe('resultsTablePresentation', () => {
  it('builds default container style with fallback height', () => {
    const style = getResultsTableContainerStyle({ goldLine: '#d4af37' });
    expect(style.maxHeight).toBe('72vh');
    expect(style.border).toBe('1px solid #d4af37');
    expect(style.overflow).toBe('auto');
  });

  it('respects custom max height', () => {
    const style = getResultsTableContainerStyle({ goldLine: '#fff', containerMaxHeight: '90vh' });
    expect(style.maxHeight).toBe('90vh');
  });

  it('exports conflict animation css', () => {
    expect(RESULTS_TABLE_CONFLICT_CSS).toContain('@keyframes conflictPulse');
    expect(RESULTS_TABLE_CONFLICT_CSS).toContain('box-shadow');
  });
});
