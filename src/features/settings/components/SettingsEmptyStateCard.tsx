import React from 'react';

export default function SettingsEmptyStateCard({ message }: { message: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.92)',
        background: 'rgba(0,0,0,0.20)',
      }}
    >
      {message}
    </div>
  );
}
