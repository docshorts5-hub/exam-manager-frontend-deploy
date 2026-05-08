import React from 'react';

export default function SyncEmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        color: 'rgba(245,231,178,0.8)',
        fontWeight: 800,
        border: '1px dashed rgba(255,255,255,0.16)',
        borderRadius: 12,
        padding: 12,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {message}
    </div>
  );
}
