import React from "react";

type Props = {
  errors: string[];
  runtimeError: string | null;
  warnings: string[];
  styles: {
    errorsBox: React.CSSProperties;
    errChip: React.CSSProperties;
    warnChip: React.CSSProperties;
  };
};

export default function TaskDistributionRunFeedback({ errors, runtimeError, warnings, styles }: Props) {
  if (!errors.length && !runtimeError && !warnings.length) return null;

  return (
    <>
      {errors.length > 0 && (
        <div style={styles.errorsBox}>
          {errors.map((e, i) => (
            <div key={`error-${i}`} style={styles.errChip}>
              {e}
            </div>
          ))}
        </div>
      )}

      {runtimeError && (
        <div style={styles.errorsBox}>
          <div style={styles.errChip}>❌ خطأ أثناء التشغيل: {runtimeError}</div>
        </div>
      )}

      {warnings.length > 0 && (
        <div style={styles.errorsBox}>
          {warnings.map((w, i) => (
            <div key={`warn-${i}`} style={styles.warnChip}>
              {w}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
