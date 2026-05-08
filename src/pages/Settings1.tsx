// src/pages/Settings1.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const GOVERNORATES = {
  ar: [
    "المديرية العامة للتعليم بمحافظة مسقط",
    "المديرية العامة للتعليم بمحافظة ظفار",
    "المديرية العامة للتعليم بمحافظة الداخلية",
    "المديرية العامة للتعليم بمحافظة الظاهرة",
    "المديرية العامة للتعليم بمحافظة البريمي",
    "المديرية العامة للتعليم بمحافظة شمال الشرقية",
    "المديرية العامة للتعليم بمحافظة جنوب الشرقية",
    "المديرية العامة للتعليم بمحافظة الوسطى",
    "المديرية العامة للتعليم بمحافظة شمال الباطنة",
    "المديرية العامة للتعليم بمحافظة جنوب الباطنة",
    "المديرية العامة للتعليم بمحافظة مسندم",
  ],
  en: [
    "Directorate General of Education in Muscat Governorate",
    "Directorate General of Education in Dhofar Governorate",
    "Directorate General of Education in Al Dakhiliyah Governorate",
    "Directorate General of Education in Al Dhahirah Governorate",
    "Directorate General of Education in Al Buraimi Governorate",
    "Directorate General of Education in North Al Sharqiyah Governorate",
    "Directorate General of Education in South Al Sharqiyah Governorate",
    "Directorate General of Education in Al Wusta Governorate",
    "Directorate General of Education in North Al Batinah Governorate",
    "Directorate General of Education in South Al Batinah Governorate",
    "Directorate General of Education in Musandam Governorate",
  ],
} as const;

const SEMESTERS = {
  ar: ["الفصل الدراسي الأول", "الفصل الدراسي الثاني"],
  en: ["First Semester", "Second Semester"],
} as const;

type SchoolData = {
  name: string;
  governorate: string;
  semester: string;
  phone: string;
  address: string;
};

function getAcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
}

export default function Settings1() {
  const { lang, isRTL } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const governorates = GOVERNORATES[lang];
  const semesters = SEMESTERS[lang];

  const [data, setData] = useState<SchoolData>({
    name: "",
    governorate: "",
    semester: "",
    phone: "",
    address: "",
  });

  const [logo, setLogo] = useState<string>(DEFAULT_LOGO_URL);

  useEffect(() => {
    const savedData = localStorage.getItem(SCHOOL_DATA_KEY);
    if (savedData) setData(JSON.parse(savedData) as SchoolData);

    const savedLogo = localStorage.getItem(LOGO_KEY);
    if (savedLogo) setLogo(savedLogo);
  }, []);

  const handleChange = (field: keyof SchoolData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const saveData = () => {
    localStorage.setItem(SCHOOL_DATA_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("exam-manager:changed"));
    alert(tr("تم حفظ التغييرات بنجاح!", "Changes saved successfully!"));
  };

  const academicYear = useMemo(() => getAcademicYearFromSystemDate(new Date()), []);

  const previewGov = data.governorate?.trim() || tr("المحافظة / المديرية ...", "Governorate / Directorate ...");
  const previewSchool = data.name?.trim() || tr("المدرسة ...", "School ...");
  const previewSemester = data.semester?.trim() || tr("الفصل الدراسي الأول", "First Semester");

  return (
    <div style={{ ...pageWrap, direction: isRTL ? "rtl" : "ltr" }}>
      <div
        style={{
          position: "absolute",
          top: -180,
          left: "50%",
          transform: "translateX(-50%)",
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.05) 38%, transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: isRTL ? -120 : "auto",
          left: isRTL ? "auto" : -120,
          top: 260,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.10), transparent 72%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 1380, position: "relative", zIndex: 1, display: "grid", gap: 22 }}>
        <div
          style={{
            display: "grid",
            gap: 18,
            border: "5px solid #e6d27a",
            borderRadius: 34,
            padding: 28,
            background: "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
            boxShadow: "0 0 0 6px rgba(245,232,170,0.35) inset, 0 10px 28px rgba(190,160,40,0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              flexWrap: "wrap",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 14, maxWidth: 900 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.22)",
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {tr("إعداد الهوية الرسمية للمدرسة والتقارير", "Configure the school's official identity and reports")}
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#000000", marginBottom: 10 }}>
                  {tr("نظام إدارة الامتحانات الذكي", "Smart Exam Management System")}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "clamp(34px, 5vw, 60px)",
                    lineHeight: 1.05,
                    fontWeight: 950,
                    color: "#000000",
                    letterSpacing: "-0.03em",
                    textShadow: "0 8px 28px rgba(212,175,55,0.16)",
                  }}
                >
                  {tr("مركز بيانات المدرسة", "School Profile Center")}
                </h1>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 2,
                  color: "#000000",
                  maxWidth: 940,
                }}
              >
                {tr(
                  "تمنح هذه الصفحة الإدارة واجهة أنيقة لإدخال بيانات المدرسة الرسمية وربطها فورًا بمعاينة واقعية للتقارير والمطبوعات، بما يعزز الهوية البصرية ويجعل إعداد البيانات أكثر وضوحًا وفخامة.",
                  "This page gives administrators an elegant interface to enter official school data and instantly link it to a realistic preview of reports and printouts, enhancing the visual identity and making data setup clearer and more premium."
                )}
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: tr("اسم المدرسة", "School Name"), value: previewSchool },
                  { label: tr("الفصل", "Semester"), value: previewSemester },
                  { label: tr("العام الدراسي", "Academic Year"), value: academicYear },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: "2px solid #ead98b",
                      background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
                      borderRadius: 18,
                      padding: "12px 14px",
                      minWidth: 190,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(190,160,40,0.10)",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#000000", fontWeight: 800 }}>{item.label}</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#000000", fontWeight: 900 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                minWidth: 300,
                maxWidth: 390,
                width: "100%",
                border: "2px solid #ead98b",
                borderRadius: 28,
                padding: 22,
                background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(16,185,129,0.14)",
                  border: "1px solid rgba(16,185,129,0.24)",
                  color: "#000000",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {tr("معاينة مباشرة وهوية مؤسسية", "Live preview and institutional identity")}
              </div>

              <div style={{ fontSize: 28, lineHeight: 1.5, fontWeight: 950, color: "#000000" }}>
                {tr(
                  "اكتب البيانات مرة واحدة وشاهد شكلها النهائي داخل نموذج التقرير فورًا.",
                  "Enter the data once and instantly see its final appearance inside the report template."
                )}
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.95, color: "#000000" }}>
                {tr(
                  "تم تطوير الصفحة لتجمع بين سهولة إدخال البيانات وجمال المعاينة الرسمية، بحيث يشعر المستخدم بأنه يتعامل مع منتج شركة عالمية من أول لحظة.",
                  "This page was designed to combine easy data entry with a beautiful official preview, so the user feels they are using a world-class product from the very first moment."
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={gridWrap}>
          <div style={formCard}>
            <h1 style={{ ...formTitle, textAlign: isRTL ? "right" : "left" }}>
              {tr("بيانات المدرسة", "School Data")}
            </h1>
            <div
              style={{
                marginTop: -4,
                marginBottom: 18,
                color: "#000000",
                fontSize: 14,
                lineHeight: 1.9,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {tr(
                "أدخل البيانات الرسمية التي ستظهر في الترويسة والمطبوعات والتقارير داخل النظام.",
                "Enter the official data that will appear in the letterhead, printouts, and reports within the system."
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>{tr("اسم المدرسة", "School Name")}</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  style={{ ...inputStyle, color: "#000000", caretColor: "#000000", WebkitTextFillColor: "#000000", fontWeight: 900 }}
                />
              </div>

              <div>
                <label style={labelStyle}>{tr("المحافظة / المديرية", "Governorate / Directorate")}</label>
                <select
                  value={data.governorate}
                  onChange={(e) => handleChange("governorate", e.target.value)}
                  style={{ ...selectStyle, color: "#000000", caretColor: "#000000", WebkitTextFillColor: "#000000", fontWeight: 900 }}
                >
                  <option value="" style={{ ...optionStyle, color: "#000000", fontWeight: 900 }}>
                    {tr("اختر...", "Select...")}
                  </option>
                  {governorates.map((gov) => (
                    <option key={gov} value={gov} style={{ ...optionStyle, color: "#000000", fontWeight: 900 }}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>{tr("الفصل الدراسي", "Semester")}</label>
                <select
                  value={data.semester}
                  onChange={(e) => handleChange("semester", e.target.value)}
                  style={{ ...selectStyle, color: "#000000", caretColor: "#000000", WebkitTextFillColor: "#000000", fontWeight: 900 }}
                >
                  <option value="" style={{ ...optionStyle, color: "#000000", fontWeight: 900 }}>
                    {tr("اختر...", "Select...")}
                  </option>
                  {semesters.map((sem) => (
                    <option key={sem} value={sem} style={{ ...optionStyle, color: "#000000", fontWeight: 900 }}>
                      {sem}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>{tr("رقم الهاتف", "Phone Number")}</label>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  style={{ ...inputStyle, color: "#000000", caretColor: "#000000", WebkitTextFillColor: "#000000", fontWeight: 900 }}
                />
              </div>

              <div>
                <label style={labelStyle}>{tr("العنوان", "Address")}</label>
                <textarea
                  value={data.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  style={{ ...inputStyle, height: 110, resize: "vertical" }}
                />
              </div>

              <button onClick={saveData} style={saveBtn}>
                {tr("حفظ التغييرات", "Save Changes")}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "start" }}>
            <div style={previewOuter}>
              <div style={previewPaper}>
                <div
                  style={{
                    display: "inline-flex",
                    marginBottom: 16,
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "rgba(212,175,55,0.10)",
                    border: "1px solid rgba(212,175,55,0.22)",
                    color: "#000000",
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {tr("المعاينة الرسمية المباشرة", "Live official preview")}
                </div>

                <div style={mastheadGrid}>
                  <div style={{ textAlign: isRTL ? "right" : "left" }}>
                    <div style={rightGold}>{tr("سلطنة عمان", "Sultanate of Oman")}</div>
                    <div style={{ ...rightGold, marginTop: 6 }}>{tr("وزارة التعليم", "Ministry of Education")}</div>
                    <div style={rightGoldSoft}>{previewGov}</div>
                    <div style={{ ...rightGoldSoft, marginTop: 6 }}>{previewSchool}</div>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <img src={logo} alt={tr("شعار", "Logo")} style={logoStyle} />
                  </div>

                  <div style={{ textAlign: isRTL ? "left" : "right" }}>
                    <div style={leftGold}>{previewSemester}</div>
                    <div style={{ ...leftGold, marginTop: 8 }}>
                      {tr("العام الدراسي", "Academic Year")} {academicYear}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    ...mastheadRuleThin,
                    background: isRTL
                      ? `linear-gradient(to left, ${gold}, ${goldDark}, ${goldDeep})`
                      : `linear-gradient(to right, ${gold}, ${goldDark}, ${goldDeep})`,
                  }}
                />

                <div style={belowRuleRow}>
                  <div style={belowTitle}>{tr("كشف توزيع مهام المراقبة", "Invigilation Duties Distribution Sheet")}</div>

                  <div style={belowMeta}>
                    <span style={belowMetaItem}>{previewSemester}</span>
                    <span style={belowMetaSep}>|</span>
                    <span style={belowMetaItem}>
                      {tr("العام الدراسي", "Academic Year")} {academicYear}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>
          {`
            select option {
              background: #000000;
              color: #ffffff;
            }

            input::placeholder,
            textarea::placeholder {
              color: rgba(255,255,255,0.65);
            }

            @media (max-width: 980px) {
              .settings1-grid-fallback {
                grid-template-columns: 1fr !important;
              }
            }
          `}
        </style>
      </div>
    </div>
  );
}

/* ===== Colors ===== */

const gold = "#D4AF37";
const goldLight = "#D4AF37";
const goldDark = "#B38E24";
const goldDeep = "#6A500B";

const white = "#FFFFFF";
const whiteSoft = "rgba(255,255,255,0.92)";
const whiteGlow =
  "0 0 6px rgba(255,255,255,0.18), 0 0 12px rgba(255,255,255,0.08)";
const whiteGlowStrong =
  "0 0 8px rgba(255,255,255,0.22), 0 0 16px rgba(255,255,255,0.1)";

/* ===== Styles ===== */

const pageWrap: React.CSSProperties = {
  direction: "rtl",
  minHeight: "100vh",
  padding: "24px",
  background: "#f7f3e7",
  color: "#000000",
  display: "flex",
  justifyContent: "center",
};

const gridWrap: React.CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  alignItems: "start",
};

const formCard: React.CSSProperties = {
  background: "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
  borderRadius: 28,
  padding: 28,
  color: "#000000",
  border: `5px solid ${gold}`,
  boxShadow: `
    0 28px 70px rgba(0,0,0,0.7),
    0 0 0 4px rgba(212,175,55,0.18),
    0 0 24px rgba(212,175,55,0.16),
    inset 2px 2px 0 rgba(240,214,120,0.75),
    inset 0 0 0 2px rgba(212,175,55,0.28),
    inset -4px -6px 0 rgba(106,80,11,0.95),
    inset 0 -12px 24px rgba(0,0,0,0.45)
  `,
  transform: "translateY(-4px)",
};

const formTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 20,
  color: "#000000",
  
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 16,
  color: "#000000",
  marginBottom: 6,
  fontWeight: 900,
  
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 22,
  background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
  border: "2px solid #ead98b",
  color: "#000000",
  caretColor: "#000000",
  WebkitTextFillColor: "#000000",
  fontSize: 17,
  fontWeight: 900,
  outline: "none",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
  backgroundColor: "#faf7ee",
  color: "#000000",
  caretColor: "#000000",
  WebkitTextFillColor: "#000000",
  fontWeight: 900,
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const optionStyle: React.CSSProperties = {
  backgroundColor: "#faf7ee",
  color: "#000000",
  fontWeight: 900,
};

const saveBtn: React.CSSProperties = {
  padding: "14px 24px",
  borderRadius: 22,
  background: "linear-gradient(180deg, #bfdbfe 0%, #93c5fd 100%)",
  color: "#000000",
  fontWeight: 900,
  border: "2px solid #2563eb",
  cursor: "pointer",
  marginTop: 12,
  boxShadow:
    "0 14px 30px rgba(0,0,0,0.4), inset 1px 1px 6px rgba(255,255,255,0.35), 0 0 14px rgba(212,175,55,0.18)",
};

const previewOuter: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "linear-gradient(180deg, #f7f3e7 0%, #f3efdf 100%)",
  borderRadius: 28,
  padding: 26,
  border: `6px solid ${gold}`,
  boxShadow: `
    0 30px 75px rgba(0,0,0,0.72),
    0 0 0 4px rgba(212,175,55,0.18),
    0 0 28px rgba(212,175,55,0.16),
    inset 2px 2px 0 rgba(240,214,120,0.8),
    inset 0 0 0 2px rgba(212,175,55,0.34),
    inset -5px -7px 0 rgba(106,80,11,0.98),
    inset 0 -14px 28px rgba(0,0,0,0.46)
  `,
  transform: "translateY(-4px)",
};

const previewPaper: React.CSSProperties = {
  background: "linear-gradient(180deg, #faf7ee 0%, #f6f1e2 100%)",
  borderRadius: 18,
  padding: "26px 28px",
  minHeight: 280,
  border: `2px solid rgba(212,175,55,0.45)`,
  boxShadow:
    "inset 0 2px 10px rgba(255,255,255,0.04), inset 0 -8px 18px rgba(0,0,0,0.35)",
};

const mastheadGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 180px 1fr",
  alignItems: "center",
  gap: 12,
};

const logoStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  objectFit: "contain",
  display: "block",
  margin: "0 auto",
  filter:
    "drop-shadow(0 4px 8px rgba(0,0,0,0.4)) drop-shadow(0 0 10px rgba(212,175,55,0.14))",
};

const mastheadRuleThin: React.CSSProperties = {
  marginTop: 14,
  height: 3,
  borderRadius: 999,
  background: `linear-gradient(to left, ${gold}, ${goldDark}, ${goldDeep})`,
  boxShadow: "0 0 10px rgba(212,175,55,0.3)",
};

const rightGold: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: "#000000",
  lineHeight: 1.2,
  
};

const rightGoldSoft: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 900,
  fontSize: 16,
  color: "#000000",
  lineHeight: 1.2,
  
};

const leftGold: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: "#000000",
  lineHeight: 1.25,
  
};

const belowRuleRow: React.CSSProperties = {
  marginTop: 22,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const belowTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#000000",
  textDecoration: "underline",
  textUnderlineOffset: 4,
  
};

const belowMeta: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: "#000000",
  display: "flex",
  alignItems: "center",
  gap: 10,
  
};

const belowMetaItem: React.CSSProperties = {
  fontWeight: 900,
};

const belowMetaSep: React.CSSProperties = {
  opacity: 0.95,
  color: "#000000",
  
};
