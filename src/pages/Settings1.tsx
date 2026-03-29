// src/pages/Settings1.tsx
import React, { useEffect, useMemo, useState } from "react";

const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";
const LOGO_KEY = "exam-manager:app-logo";
const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";

const GOVERNORATES = [
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
];

const SEMESTERS = ["الفصل الدراسي الأول", "الفصل الدراسي الثاني"];

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
    alert("تم حفظ التغييرات بنجاح!");
  };

  const academicYear = useMemo(() => getAcademicYearFromSystemDate(new Date()), []);

  const previewGov = data.governorate?.trim() || "المحافظة / المديرية ...";
  const previewSchool = data.name?.trim() || "المدرسة ...";
  const previewSemester = data.semester?.trim() || "الفصل الدراسي الأول";

  return (
    <div style={pageWrap}>
      <div style={gridWrap}>
        <div style={formCard}>
          <h1 style={formTitle}>بيانات المدرسة</h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>اسم المدرسة</label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => handleChange("name", e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>المحافظة / المديرية</label>
              <select
                value={data.governorate}
                onChange={(e) => handleChange("governorate", e.target.value)}
                style={selectStyle}
              >
                <option value="" style={optionStyle}>
                  اختر...
                </option>
                {GOVERNORATES.map((gov) => (
                  <option key={gov} value={gov} style={optionStyle}>
                    {gov}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>الفصل الدراسي</label>
              <select
                value={data.semester}
                onChange={(e) => handleChange("semester", e.target.value)}
                style={selectStyle}
              >
                <option value="" style={optionStyle}>
                  اختر...
                </option>
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem} style={optionStyle}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>رقم الهاتف</label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>العنوان</label>
              <textarea
                value={data.address}
                onChange={(e) => handleChange("address", e.target.value)}
                style={{ ...inputStyle, height: 110, resize: "vertical" }}
              />
            </div>

            <button onClick={saveData} style={saveBtn}>
              حفظ التغييرات
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={previewOuter}>
            <div style={previewPaper}>
              <div style={mastheadGrid}>
                <div style={{ textAlign: "right" }}>
                  <div style={rightGold}>سلطنة عمان</div>
                  <div style={{ ...rightGold, marginTop: 6 }}>وزارة التعليم</div>
                  <div style={rightGoldSoft}>{previewGov}</div>
                  <div style={{ ...rightGoldSoft, marginTop: 6 }}>{previewSchool}</div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <img src={logo} alt="شعار" style={logoStyle} />
                </div>

                <div style={{ textAlign: "left" }}>
                  <div style={leftGold}>{previewSemester}</div>
                  <div style={{ ...leftGold, marginTop: 8 }}>
                    العام الدراسي {academicYear}
                  </div>
                </div>
              </div>

              <div style={mastheadRuleThin} />

              <div style={belowRuleRow}>
                <div style={belowTitle}>كشف توزيع مهام المراقبة</div>

                <div style={belowMeta}>
                  <span style={belowMetaItem}>{previewSemester}</span>
                  <span style={belowMetaSep}>|</span>
                  <span style={belowMetaItem}>العام الدراسي {academicYear}</span>
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
        `}
      </style>
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
  background: "#000000",
  color: "#ffffff",
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
  background: "linear-gradient(145deg, #050505 0%, #0d0d0d 55%, #000000 100%)",
  borderRadius: 28,
  padding: 28,
  color: white,
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
  color: white,
  textShadow: whiteGlowStrong,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: white,
  marginBottom: 6,
  fontWeight: 800,
  textShadow: whiteGlow,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  background: "#000000",
  border: `1px solid ${goldDark}`,
  color: "#ffffff",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
  boxShadow:
    "inset 0 2px 8px rgba(255,255,255,0.04), 0 0 8px rgba(212,175,55,0.08)",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: "#000000",
  color: "#ffffff",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const optionStyle: React.CSSProperties = {
  backgroundColor: "#000000",
  color: "#ffffff",
};

const saveBtn: React.CSSProperties = {
  padding: "14px 24px",
  borderRadius: 14,
  background: `linear-gradient(145deg, ${gold}, ${goldDark}, ${goldDeep})`,
  color: "#FFFFFF",
  fontWeight: 900,
  border: `2px solid ${gold}`,
  cursor: "pointer",
  marginTop: 12,
  boxShadow:
    "0 14px 30px rgba(0,0,0,0.4), inset 1px 1px 6px rgba(255,255,255,0.35), 0 0 14px rgba(212,175,55,0.18)",
};

const previewOuter: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "linear-gradient(145deg, #050505 0%, #0d0d0d 55%, #000000 100%)",
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
  background: "linear-gradient(145deg, #080808 0%, #111111 50%, #050505 100%)",
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
  color: white,
  lineHeight: 1.2,
  textShadow: whiteGlowStrong,
};

const rightGoldSoft: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 900,
  fontSize: 13,
  color: whiteSoft,
  lineHeight: 1.2,
  textShadow: whiteGlow,
};

const leftGold: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: white,
  lineHeight: 1.25,
  textShadow: whiteGlowStrong,
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
  color: white,
  textDecoration: "underline",
  textUnderlineOffset: 4,
  textShadow: whiteGlowStrong,
};

const belowMeta: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: white,
  display: "flex",
  alignItems: "center",
  gap: 10,
  textShadow: whiteGlow,
};

const belowMetaItem: React.CSSProperties = {
  fontWeight: 900,
};

const belowMetaSep: React.CSSProperties = {
  opacity: 0.95,
  color: whiteSoft,
  textShadow: whiteGlow,
};