import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { loadRun, RUN_UPDATED_EVENT } from "../utils/taskDistributionStorage";
import type { Assignment, DistributionRun, TaskType } from "../contracts/taskDistributionContract";

const MASTER_TABLE_KEY = "exam-manager:task-distribution:master-table:v1";
const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

type SchoolData = {
  name?: string;
  governorate?: string;
  semester?: string;
  phone?: string;
  address?: string;
};

type ResultsData = {
  assignments: Assignment[];
  runId?: string;
  createdAtISO?: string;
  warnings?: string[];
  source: "run" | "master-table";
};

function taskLabel(t: TaskType | string | undefined) {
  switch (t) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "REVIEW_FREE":
      return "فاضي للمراجعة";
    case "CORRECTION_FREE":
      return "فاضي للتصحيح";
    default:
      return "فارغ";
  }
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getAcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return `${startYear} - ${startYear + 1}`;
}

function getSchoolData() {
  const data = safeJson<SchoolData>(localStorage.getItem(SCHOOL_DATA_KEY), {});
  const logo = localStorage.getItem(LOGO_KEY) || DEFAULT_LOGO_URL;
  return {
    data,
    logo,
  };
}

function safeReadMasterTable(): ResultsData | null {
  try {
    const raw = localStorage.getItem(MASTER_TABLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.rows)
      ? parsed.rows
      : Array.isArray(parsed?.data)
        ? parsed.data
        : [];
    if (!rows.length) return null;

    return {
      assignments: rows,
      runId: parsed?.meta?.runId,
      createdAtISO: parsed?.meta?.runCreatedAtISO || parsed?.meta?.createdAtISO,
      warnings: [],
      source: "master-table",
    };
  } catch {
    return null;
  }
}

function buildResultsData(tenantId: string): ResultsData | null {
  const run = loadRun(tenantId) as DistributionRun | null;
  if (run?.assignments?.length) {
    return {
      assignments: run.assignments,
      runId: run.runId,
      createdAtISO: run.createdAtISO,
      warnings: run.warnings || [],
      source: "run",
    };
  }

  return safeReadMasterTable();
}

function normalizePeriodForDisplay(period: unknown): "AM" | "PM" | "RAW" {
  const value = String(period || "").replace(/\s+/g, " ").trim();
  const lower = value.toLowerCase();
  const compact = lower.replace(/[\.\s_-]+/g, "");

  if (value.includes("الثانية") || value.includes("ثانيه") || lower.includes("second") || compact === "pm" || compact === "bm" || compact === "p2" || compact === "period2" || compact === "2" || compact === "p") return "PM";
  if (value.includes("الأولى") || value.includes("اولى") || lower.includes("first") || compact === "am" || compact === "p1" || compact === "period1" || compact === "1" || compact === "a") return "AM";
  return "RAW";
}

function periodLabel(period: unknown) {
  const normalized = normalizePeriodForDisplay(period);
  if (normalized === "AM") return "الفترة الأولى";
  if (normalized === "PM") return "الفترة الثانية";
  const value = String(period || "").trim();
  return value || "-";
}

function sourceLabel(source: ResultsData["source"]) {
  return source === "run" ? "آخر تشغيل" : "الجدول المحفوظ";
}

function toneStyle(color: string): React.CSSProperties {
  return {
    borderColor: color,
    boxShadow: `0 10px 22px ${color}22`,
  };
}

export default function TaskDistributionResults() {
  const nav = useNavigate();
  const { user, profile, effectiveTenantId } = useAuth() as any;
  const tenantId = String(effectiveTenantId || profile?.tenantId || user?.tenantId || "").trim() || "default";

  const [results, setResults] = useState<ResultsData | null>(() => buildResultsData(tenantId));
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [teacherFilter, setTeacherFilter] = useState<string>("");
  const [schoolInfo, setSchoolInfo] = useState(() => getSchoolData());

  useEffect(() => {
    const refresh = () => setResults(buildResultsData(tenantId));
    refresh();

    window.addEventListener("focus", refresh);
    window.addEventListener(RUN_UPDATED_EVENT, refresh as EventListener);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(RUN_UPDATED_EVENT, refresh as EventListener);
    };
  }, [tenantId]);

  useEffect(() => {
    const refreshSchool = () => setSchoolInfo(getSchoolData());

    refreshSchool();
    window.addEventListener("exam-manager:changed", refreshSchool);
    window.addEventListener("storage", refreshSchool);

    return () => {
      window.removeEventListener("exam-manager:changed", refreshSchool);
      window.removeEventListener("storage", refreshSchool);
    };
  }, []);

  const assignments = useMemo(() => results?.assignments || [], [results]);

  const dates = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach((a) => s.add(String((a as any).dateISO || "")));
    return ["ALL", ...Array.from(s).filter(Boolean).sort()];
  }, [assignments]);

  const types = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach((a) => s.add(String((a as any).taskType || "")));
    return ["ALL", ...Array.from(s).filter(Boolean).sort()];
  }, [assignments]);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      const row = a as any;

      if (dateFilter !== "ALL" && row.dateISO !== dateFilter) return false;
      if (typeFilter !== "ALL" && row.taskType !== typeFilter) return false;

      if (teacherFilter.trim()) {
        const q = teacherFilter.trim().toLowerCase();
        if (!String(row.teacherName || "").toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [assignments, dateFilter, typeFilter, teacherFilter]);

  const schoolName = schoolInfo.data.name?.trim() || "اسم المدرسة";
  const governorate = schoolInfo.data.governorate?.trim() || "المحافظة / المديرية";
  const semester = schoolInfo.data.semester?.trim() || "الفصل الدراسي";
  const academicYear = getAcademicYearFromSystemDate();

  const totalTeachers = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach((a) => s.add(String((a as any).teacherName || "")));
    return Array.from(s).filter(Boolean).length;
  }, [assignments]);

  const totalDates = useMemo(() => {
    const s = new Set<string>();
    assignments.forEach((a) => s.add(String((a as any).dateISO || "")));
    return Array.from(s).filter(Boolean).length;
  }, [assignments]);

  const warningsCount = results?.warnings?.length || 0;

  const noResultsBody = (
    <main style={pageWrap}>
      <section style={officialHeaderStyle}>
        <div style={officialTextStyle}>
          <div style={govTitleStyle}>سلطنة عمان</div>
          <div style={govLineStyle}>وزارة التعليم</div>
          <div style={govLineStyle}>{governorate}</div>
          <div style={schoolTitleStyle}>{schoolName}</div>
        </div>

        <div style={logoBoxStyle}>
          <img src={schoolInfo.logo} alt="logo" style={logoStyle} />
        </div>

        <div style={headerMetaStyle}>
          <InfoPill label="الصفحة" value="الجدول الشامل" color="#2563eb" />
          <InfoPill label="الفصل" value={semester} color="#16a34a" />
          <InfoPill label="العام الدراسي" value={academicYear} color="#d4af37" />
        </div>
      </section>

      <section style={emptyCardStyle}>
        <div>
          <div style={sectionTitleStyle}>الجدول الشامل</div>
          <p style={sectionTextStyle}>
            لا توجد بيانات محفوظة بعد. تم فحص بيانات التشغيل المحفوظة والجدول الشامل ولم يتم العثور على بيانات.
          </p>
        </div>

        <div style={actionsStyle}>
          <button style={secondaryButtonStyle} onClick={() => nav("/task-distribution/run")}>رجوع للتوزيع</button>
          <button style={primaryButtonStyle} onClick={() => setResults(buildResultsData(tenantId))}>تحديث البيانات</button>
        </div>
      </section>
    </main>
  );

  if (!results) return noResultsBody;

  return (
    <main style={pageWrap}>
      <section style={officialHeaderStyle}>
        <div style={officialTextStyle}>
          <div style={govTitleStyle}>سلطنة عمان</div>
          <div style={govLineStyle}>وزارة التعليم</div>
          <div style={govLineStyle}>{governorate}</div>
          <div style={schoolTitleStyle}>{schoolName}</div>
        </div>

        <div style={logoBoxStyle}>
          <img src={schoolInfo.logo} alt="logo" style={logoStyle} />
        </div>

        <div style={headerMetaStyle}>
          <InfoPill label="الصفحة" value="الجدول الشامل" color="#2563eb" />
          <InfoPill label="الفصل" value={semester} color="#16a34a" />
          <InfoPill label="العام الدراسي" value={academicYear} color="#d4af37" />
        </div>
      </section>

      <section style={heroCardStyle}>
        <div>
          <div style={badgeStyle}>منصة تشغيل توزيع المهام</div>
          <h1 style={heroTitleStyle}>الجدول الشامل</h1>
          <p style={heroTextStyle}>
            عرض منظم لجميع مهام المراقبة والاحتياط والمراجعة والتصحيح بعد تشغيل التوزيع.
          </p>
        </div>

        <div style={actionsStyle}>
          <button style={secondaryButtonStyle} onClick={() => nav("/task-distribution/run")}>رجوع للتوزيع</button>
          <button style={blueButtonStyle} onClick={() => setResults(buildResultsData(tenantId))}>تحديث</button>
          <button style={primaryButtonStyle} onClick={() => nav("/task-distribution/print")}>طباعة التقرير</button>
        </div>

        <div style={sourceBoxStyle}>
          <strong>المصدر:</strong> {sourceLabel(results.source)}
          {results.runId ? ` — Run: ${results.runId}` : ""}
          {results.createdAtISO ? ` — ${results.createdAtISO}` : ""}
        </div>
      </section>

      <section style={statsGridStyle}>
        <StatCard label="إجمالي المهام" value={assignments.length} color="#d4af37" />
        <StatCard label="عدد المعلمين" value={totalTeachers} color="#16a34a" />
        <StatCard label="أيام التوزيع" value={totalDates} color="#2563eb" />
        <StatCard label="التحذيرات" value={warningsCount} color="#dc2626" />
      </section>

      <section style={panelStyle}>
        <div style={sectionHeadStyle}>
          <div>
            <h2 style={sectionTitleStyle}>التنبيهات</h2>
            <p style={sectionTextStyle}>مراجعة أي رسائل ناتجة عن تشغيل الخوارزمية.</p>
          </div>

          <span style={{ ...smallChipStyle, ...toneStyle(warningsCount ? "#dc2626" : "#16a34a") }}>
            {warningsCount ? `${warningsCount} تنبيه` : "لا توجد تحذيرات"}
          </span>
        </div>

        {(results.warnings || []).length ? (
          <div style={warningsListStyle}>
            {results.warnings!.map((warning, index) => (
              <div key={`${warning}-${index}`} style={warningItemStyle}>{warning}</div>
            ))}
          </div>
        ) : (
          <div style={successNoticeStyle}>لا يوجد تحذيرات.</div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={sectionHeadStyle}>
          <div>
            <h2 style={sectionTitleStyle}>تصفية الجدول</h2>
            <p style={sectionTextStyle}>استخدم الفلاتر للوصول السريع إلى بيانات يوم أو معلم أو نوع مهمة.</p>
          </div>
        </div>

        <div style={filtersGridStyle}>
          <FilterBox label="اليوم" color="#2563eb">
            <select style={inputStyle} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              {dates.map((date) => (
                <option key={date} value={date}>{date === "ALL" ? "الكل" : date}</option>
              ))}
            </select>
          </FilterBox>

          <FilterBox label="نوع المهمة" color="#16a34a">
            <select style={inputStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {types.map((type) => (
                <option key={type} value={type}>{type === "ALL" ? "الكل" : taskLabel(type)}</option>
              ))}
            </select>
          </FilterBox>

          <FilterBox label="بحث بالمعلم" color="#d4af37">
            <input
              style={inputStyle}
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              placeholder="اكتب اسم المعلم..."
            />
          </FilterBox>
        </div>
      </section>

      <section style={tablePanelStyle}>
        <div style={sectionHeadStyle}>
          <div>
            <h2 style={sectionTitleStyle}>جدول المهام</h2>
            <p style={sectionTextStyle}>إجمالي المعروض حاليًا: {filtered.length}</p>
          </div>
        </div>

        <div style={tableScrollStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thStyle, borderTopColor: "#d4af37" }}>التاريخ</th>
                <th style={{ ...thStyle, borderTopColor: "#2563eb" }}>الفترة</th>
                <th style={{ ...thStyle, borderTopColor: "#16a34a" }}>المعلم</th>
                <th style={{ ...thStyle, borderTopColor: "#7c3aed" }}>نوع المهمة</th>
                <th style={{ ...thStyle, borderTopColor: "#ea580c" }}>المادة</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((assignment, index) => {
                const row = assignment as any;
                return (
                  <tr key={String(row.id || `${row.dateISO}-${row.period}-${row.teacherId}-${row.taskType}-${row.subject || ""}-${index}`)}>
                    <td style={{ ...tdStyle, borderInlineStart: "5px solid #d4af37" }}>{row.dateISO || "-"}</td>
                    <td style={{ ...tdStyle, borderInlineStart: "5px solid #2563eb" }}>{periodLabel(row.period)}</td>
                    <td style={{ ...tdStyle, borderInlineStart: "5px solid #16a34a" }}>{row.teacherName || "-"}</td>
                    <td style={{ ...tdStyle, borderInlineStart: "5px solid #7c3aed" }}>{taskLabel(row.taskType)}</td>
                    <td style={{ ...tdStyle, borderInlineStart: "5px solid #ea580c" }}>{row.subject || "-"}</td>
                  </tr>
                );
              })}

              {!filtered.length && (
                <tr>
                  <td style={{ ...tdStyle, textAlign: "center" }} colSpan={5}>لا توجد نتائج مطابقة للفلاتر الحالية.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function InfoPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ ...infoPillStyle, borderColor: color, background: `${color}12` }}>
      <div style={{ ...infoLabelStyle, color }}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...statCardStyle, borderColor: color, boxShadow: `0 12px 26px ${color}22` }}>
      <div style={{ ...statLabelStyle, color }}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

function FilterBox({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...filterBoxStyle, borderColor: color, boxShadow: `0 10px 22px ${color}18` }}>
      <label style={{ ...filterLabelStyle, color }}>{label}</label>
      {children}
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  direction: "rtl",
  minHeight: "100vh",
  padding: 18,
  background: "linear-gradient(180deg, #fbf8ed 0%, #efe8d6 100%)",
  display: "grid",
  gap: 18,
  fontFamily: '"Cairo", "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif',
  color: "#0f172a",
};

const officialHeaderStyle: React.CSSProperties = {
  maxWidth: 1680,
  width: "100%",
  margin: "0 auto",
  padding: 18,
  borderRadius: 30,
  border: "3px solid #d4af37",
  background: "linear-gradient(180deg, #fffdf7 0%, #f6efdc 100%)",
  boxShadow: "0 0 0 6px rgba(212,175,55,0.09) inset, 0 12px 24px rgba(150,120,20,0.10)",
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.1fr) 118px minmax(330px, 1fr)",
  alignItems: "center",
  gap: 16,
};

const officialTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const govTitleStyle: React.CSSProperties = {
  fontSize: "clamp(20px, 2.2vw, 28px)",
  fontWeight: 1000,
};

const govLineStyle: React.CSSProperties = {
  fontSize: "clamp(14px, 1.5vw, 18px)",
  fontWeight: 900,
  color: "#374151",
  lineHeight: 1.6,
};

const schoolTitleStyle: React.CSSProperties = {
  fontSize: "clamp(18px, 1.9vw, 24px)",
  fontWeight: 1000,
  lineHeight: 1.5,
};

const logoBoxStyle: React.CSSProperties = {
  width: 104,
  height: 104,
  borderRadius: 24,
  border: "3px solid #d4af37",
  background: "#fffef9",
  display: "grid",
  placeItems: "center",
  justifySelf: "center",
  boxShadow: "0 8px 18px rgba(150,120,20,0.10)",
};

const logoStyle: React.CSSProperties = {
  width: "72%",
  height: "72%",
  objectFit: "contain",
};

const headerMetaStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
  gap: 10,
};

const infoPillStyle: React.CSSProperties = {
  minHeight: 82,
  padding: "10px 14px",
  borderRadius: 18,
  border: "2px solid #d4af37",
  display: "grid",
  gap: 4,
  alignContent: "center",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 1000,
};

const infoValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 1000,
  lineHeight: 1.45,
};

const heroCardStyle: React.CSSProperties = {
  maxWidth: 1680,
  width: "100%",
  margin: "0 auto",
  padding: 22,
  borderRadius: 30,
  border: "3px solid #d4af37",
  borderInlineStart: "8px solid #16a34a",
  background: "linear-gradient(180deg, #fffdf7 0%, #f6efdc 100%)",
  boxShadow: "0 12px 24px rgba(150,120,20,0.10)",
  display: "grid",
  gap: 14,
};

const badgeStyle: React.CSSProperties = {
  width: "fit-content",
  padding: "9px 16px",
  borderRadius: 999,
  border: "2px solid rgba(22,163,74,0.26)",
  background: "rgba(22,163,74,0.10)",
  color: "#15803d",
  fontSize: 13,
  fontWeight: 1000,
};

const heroTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "clamp(30px, 4vw, 52px)",
  lineHeight: 1.2,
  fontWeight: 1000,
};

const heroTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#374151",
  fontSize: 15,
  lineHeight: 1.9,
  fontWeight: 800,
};

const sourceBoxStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 18,
  border: "2px solid rgba(37,99,235,0.35)",
  background: "#f8fbff",
  color: "#1f2937",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.8,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const buttonBase: React.CSSProperties = {
  minHeight: 46,
  padding: "0 20px",
  borderRadius: 16,
  border: "2px solid transparent",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 1000,
  boxShadow: "0 10px 22px rgba(44,35,12,0.12)",
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonBase,
  borderColor: "#16a34a",
  background: "linear-gradient(180deg, #dcfce7, #86efac)",
  color: "#065f46",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonBase,
  borderColor: "#d4af37",
  background: "linear-gradient(180deg, #fff8e1, #f6e7ad)",
  color: "#6b4f00",
};

const blueButtonStyle: React.CSSProperties = {
  ...buttonBase,
  borderColor: "#2563eb",
  background: "linear-gradient(180deg, #eff6ff, #bfdbfe)",
  color: "#1d4ed8",
};

const statsGridStyle: React.CSSProperties = {
  maxWidth: 1680,
  width: "100%",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const statCardStyle: React.CSSProperties = {
  background: "#fffdf7",
  border: "3px solid #d4af37",
  borderRadius: 22,
  padding: 18,
  display: "grid",
  gap: 8,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 1000,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 1000,
};

const panelStyle: React.CSSProperties = {
  maxWidth: 1680,
  width: "100%",
  margin: "0 auto",
  padding: 18,
  borderRadius: 26,
  border: "3px solid #d4af37",
  background: "linear-gradient(180deg, #fffdf7, #f7f0df)",
  boxShadow: "0 12px 24px rgba(150,120,20,0.10)",
  display: "grid",
  gap: 14,
};

const tablePanelStyle: React.CSSProperties = {
  ...panelStyle,
  padding: 14,
};

const sectionHeadStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(22px, 2.4vw, 34px)",
  fontWeight: 1000,
};

const sectionTextStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#374151",
  fontSize: 14,
  lineHeight: 1.8,
  fontWeight: 800,
};

const smallChipStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 999,
  border: "2px solid #d4af37",
  background: "#fffdf7",
  fontSize: 13,
  fontWeight: 1000,
};

const warningsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const warningItemStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "2px solid #dc2626",
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.7,
};

const successNoticeStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "2px solid #16a34a",
  background: "#ecfdf5",
  color: "#047857",
  fontWeight: 1000,
};

const filtersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const filterBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 14,
  borderRadius: 18,
  border: "2px solid #d4af37",
  background: "#fffdf7",
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 1000,
};

const inputStyle: React.CSSProperties = {
  minHeight: 46,
  width: "100%",
  borderRadius: 14,
  border: "2px solid rgba(212,175,55,0.76)",
  background: "#fffef9",
  color: "#0f172a",
  padding: "0 12px",
  fontSize: 14,
  fontWeight: 850,
  outline: "none",
  boxSizing: "border-box",
};

const tableScrollStyle: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: 20,
  border: "2px solid rgba(212,175,55,0.72)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 820,
  borderCollapse: "separate",
  borderSpacing: 0,
  background: "#fffaf0",
};

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  padding: "14px 12px",
  borderTop: "6px solid #d4af37",
  borderBottom: "2px solid rgba(139,106,19,0.40)",
  borderInlineEnd: "1px solid rgba(212,175,55,0.32)",
  background: "linear-gradient(180deg, #f4e6b5 0%, #d8bd62 100%)",
  color: "#0f172a",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 1000,
};

const tdStyle: React.CSSProperties = {
  padding: "13px 12px",
  borderBottom: "1px solid rgba(212,175,55,0.26)",
  borderInlineEnd: "1px solid rgba(212,175,55,0.18)",
  background: "#fffdf7",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 850,
  lineHeight: 1.7,
};

const emptyCardStyle: React.CSSProperties = {
  ...heroCardStyle,
  minHeight: 220,
  alignContent: "center",
};
