import type React from "react";
import { useI18n } from "../../../i18n/I18nProvider";
import { cardDark, ui } from "../../../styles/ui";

type WarningItem =
  | string
  | {
      id?: string;
      title?: string;
      message?: string;
      details?: string;
    };

type Props = {
  warnings?: WarningItem[];
};

const wrap: React.CSSProperties = {
  ...cardDark,
  border: "1px solid rgba(245,158,11,.28)",
  boxShadow: "0 18px 40px rgba(0,0,0,.28)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 10,
  fontSize: 18,
  fontWeight: 900,
  color: ui.warning,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingInlineStart: 20,
  color: ui.textOnDark,
  lineHeight: 1.9,
};

const itemStyle: React.CSSProperties = {
  marginBottom: 8,
};

const detailsStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: ui.textOnDarkSoft,
  fontSize: 13,
};

function getWarningKey(item: WarningItem, index: number): string {
  if (typeof item === "string") return `${index}-${item}`;
  return item.id ?? `${index}-${item.title ?? item.message ?? "warning"}`;
}

function renderWarningContent(item: WarningItem, fallbackWarningText: string) {
  if (typeof item === "string") return item;

  const mainText = item.title ?? item.message ?? fallbackWarningText;
  return (
    <>
      <strong>{mainText}</strong>
      {item.details ? <span style={detailsStyle}>{item.details}</span> : null}
    </>
  );
}

export function ResultsWarningsPanel({ warnings = [] }: Props) {
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  if (!warnings.length) return null;

  return (
    <section style={wrap} aria-label="results-warnings-panel">
      <h3 style={titleStyle}>{tr("تحذيرات النتائج", "Results Warnings")}</h3>

      <ul style={listStyle}>
        {warnings.map((warning, index) => (
          <li key={getWarningKey(warning, index)} style={itemStyle}>
            {renderWarningContent(warning, tr("تحذير", "Warning"))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default ResultsWarningsPanel;
