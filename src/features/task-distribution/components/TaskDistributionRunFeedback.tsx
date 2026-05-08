import React from "react";
import { useI18n } from "../../../i18n/I18nProvider";

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
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
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
          <div style={styles.errChip}>❌ {tr("خطأ أثناء التشغيل", "Runtime error")}: {runtimeError}</div>
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
