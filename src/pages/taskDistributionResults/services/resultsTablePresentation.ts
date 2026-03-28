import type React from 'react';

export const RESULTS_TABLE_CONFLICT_CSS = `
  @keyframes conflictPulse {
    0% { transform: scale(1); filter: saturate(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
    50% { transform: scale(1.01); filter: saturate(1.25); box-shadow: 0 0 18px rgba(239,68,68,0.55); }
    100% { transform: scale(1); filter: saturate(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
  }
`;

export function getResultsTableContainerStyle({
  containerMaxHeight,
  goldLine,
}: {
  containerMaxHeight?: string;
  goldLine: string;
}): React.CSSProperties {
  return {
    marginTop: 10,
    overflow: 'auto',
    maxHeight: containerMaxHeight ?? '72vh',
    border: `1px solid ${goldLine}`,
    borderRadius: 14,
    background:
      'radial-gradient(1200px 600px at 20% 0%, rgba(148,163,184,0.10), rgba(15,23,42,0.0) 55%), #0b1224',
    boxShadow:
      '0 18px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.35)',
  };
}
