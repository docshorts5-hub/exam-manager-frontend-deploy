import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { attachDomTranslator } from "./rawTranslations";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

const STORAGE_KEYS = ["exam-manager:lang:v1", "lang"] as const;

const DICT: Dict = {
  "audit.title": { ar: "سجل الأنشطة", en: "Activity Log" },
  "audit.empty": { ar: "لا توجد سجلات حتى الآن.", en: "No activity yet." },
  "activity.title": { ar: "سجل النشاط", en: "Activity Logs" },
  "activity.viewer": { ar: "المستخدم:", en: "User:" },
  "activity.search": { ar: "بحث (إجراء/مستخدم/كيان)...", en: "Search (action/user/entity)..." },
  "activity.allLevels": { ar: "كل المستويات", en: "All levels" },
  "activity.allActions": { ar: "كل الإجراءات", en: "All actions" },
  "activity.count": { ar: "عدد السجلات: {n}", en: "Records: {n}" },
  "activity.time": { ar: "الوقت", en: "Time" },
  "activity.level": { ar: "المستوى", en: "Level" },
  "activity.action": { ar: "الإجراء", en: "Action" },
  "activity.actor": { ar: "المستخدم", en: "Actor" },
  "activity.entity": { ar: "الكيان", en: "Entity" },
  "activity.message": { ar: "الرسالة", en: "Message" },
};

type I18nContextValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  isRTL: boolean;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string, params?: Record<string, any>) => string;
};

function replaceAllCompat(input: string, search: string, replacement: string) {
  if (!search) return input;
  return input.split(search).join(replacement);
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLang(x: any): Lang {
  return x === "en" ? "en" : "ar";
}

function readStoredLang(): Lang {
  try {
    for (const key of STORAGE_KEYS) {
      const value = localStorage.getItem(key);
      if (value === "ar" || value === "en") return value;
    }
  } catch {}
  return "ar";
}

function writeStoredLang(lang: Lang) {
  try {
    for (const key of STORAGE_KEYS) {
      localStorage.setItem(key, lang);
    }
  } catch {}
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());
  const location = useLocation();

  const setLang = (l: Lang) => {
    const next = normalizeLang(l);
    setLangState(next);
    writeStoredLang(next);
  };

  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");

  useEffect(() => {
    try {
      const dir = lang === "ar" ? "rtl" : "ltr";
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
      document.body.dir = dir;
      document.body.style.direction = dir;
    } catch {}
  }, [lang]);

  useEffect(() => {
    return attachDomTranslator(lang);
  }, [lang, location.pathname, location.search, location.hash]);

  const t = useMemo(() => {
    return (key: string, params?: Record<string, any>) => {
      const k = String(key ?? "");
      const entry = DICT[k];
      const base = entry ? entry[lang] : k;
      if (!params) return base;
      return Object.keys(params).reduce((acc, p) => replaceAllCompat(acc, `{${p}}`, String(params[p] ?? "")), base);
    };
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", isRTL: lang === "ar", setLang, toggleLang, t }),
    [lang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: "ar" as const,
      dir: "rtl" as const,
      isRTL: true,
      setLang: (_: Lang) => {},
      toggleLang: () => {},
      t: (k: string) => String(k ?? ""),
    };
  }
  return ctx;
}
