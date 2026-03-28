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
  "المديرية العامة للتعليم بمحافظة شمال الشرقية ",
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
  // افتراض: العام الدراسي يبدأ في سبتمبر
  const month = now.getMonth() + 1; // 1..12
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

  // العام الدراسي يتولد تلقائيًا
  const academicYear = useMemo(() => getAcademicYearFromSystemDate(new Date()), []);

  const previewGov = data.governorate?.trim() || "المحافظة / المديرية ...";
  const previewSchool = data.name?.trim() || "المدرسة ...";
  const previewSemester = data.semester?.trim() || "الفصل الدراسي الأول";

  return (
    <div style={pageWrap}>
      <div style={gridWrap}>
        {/* اليسار: نموذج الإدخال */}
        <div style={formCard}>
          <h1 style={formTitle}>بيانات المدرسة</h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* اسم المدرسة */}
            <div>
              <label style={labelStyle}>اسم المدرسة</label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => handleChange("name", e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* المحافظة / المديرية */}
            <div>
              <label style={labelStyle}>المحافظة / المديرية</label>
              <select
                value={data.governorate}
                onChange={(e) => handleChange("governorate", e.target.value)}
                style={selectStyle}
              >
                <option value="">اختر...</option>
                {GOVERNORATES.map((gov) => (
                  <option key={gov} value={gov} style={optionStyle}>
                    {gov}
                  </option>
                ))}
              </select>
            </div>

            {/* الفصل الدراسي */}
            <div>
              <label style={labelStyle}>الفصل الدراسي</label>
              <select
                value={data.semester}
                onChange={(e) => handleChange("semester", e.target.value)}
                style={selectStyle}
              >
                <option value="">اختر...</option>
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem} style={optionStyle}>
                    {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* رقم الهاتف */}
            <div>
              <label style={labelStyle}>رقم الهاتف</label>
              <input
                type="tel"
                value={data.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* العنوان */}
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

        {/* اليمين: معاينة الطباعة */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={previewOuter}>
            <div style={previewPaper}>
              {/* الترويسة: يمين + شعار وسط + يسار */}
              <div style={mastheadGrid}>
                {/* يمين الصفحة */}
                <div style={{ textAlign: "right" }}>
                  <div style={rightBlack}>سلطنة عمان</div>
                  <div style={{ ...rightBlack, marginTop: 6 }}>وزارة التعليم</div>
                  <div style={rightBlue}>{previewGov}</div>
                  <div style={{ ...rightBlue, marginTop: 6 }}>{previewSchool}</div>
                </div>

                {/* الوسط: الشعار */}
                <div style={{ textAlign: "center" }}>
                  <img src={logo} alt="شعار" style={logoStyle} />
                </div>

                {/* يسار الصفحة */}
                <div style={{ textAlign: "left" }}>
                  <div style={leftBlack}>{previewSemester}</div>
                  <div style={{ ...leftBlack, marginTop: 8 }}>
                    العام الدراسي {academicYear}
                  </div>
                </div>
              </div>

              {/* الخط الفاصل */}
              <div style={mastheadRuleThin} />

              {/* ✅ أسفل الخط: العنوان + (جنبها مباشرة) الفصل + العام */}
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
    </div>
  );
}

/* ===== Styles ===== */

const pageWrap: React.CSSProperties = {
  direction: "rtl",
  minHeight: "100vh",
  padding: "24px",
  background:
    "radial-gradient(ellipse at top right, rgba(139,92,246,0.18), transparent 60%), #0f172a",
  color: "#e2e8f0",
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
  background: "rgba(30,41,59,0.75)",
  borderRadius: 18,
  padding: 28,
  boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const formTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 20,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  opacity: 0.85,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#e2e8f0",
  fontSize: 15,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  color: "rgba(255,255,255,0.92)", // ✅ أبيض غامق داخل القائمة المنسدلة
};

const optionStyle: React.CSSProperties = {
  color: "rgba(15,23,42,0.95)", // لون العناصر داخل قائمة الخيارات
};

const saveBtn: React.CSSProperties = {
  padding: "14px 24px",
  borderRadius: 14,
  background: "linear-gradient(135deg, #a855f7, #ec4899)",
  color: "white",
  fontWeight: 900,
  border: "none",
  cursor: "pointer",
  marginTop: 12,
  boxShadow: "0 10px 26px rgba(168,85,247,0.28)",
};

const previewOuter: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "#ffffff",
  borderRadius: 22,
  boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
  padding: 26,
};

const previewPaper: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: "26px 28px",
  minHeight: 280,
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
};

const mastheadRuleThin: React.CSSProperties = {
  marginTop: 14,
  height: 1,
  background: "rgba(0,0,0,0.15)",
};

// يمين (ثابت أسود)
const rightBlack: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: "#000000",
  lineHeight: 1.2,
};

// يمين (متغير أزرق غامق)
const rightBlue: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 900,
  fontSize: 13,
  color: "#1e3a8a",
  lineHeight: 1.2,
};

// يسار (أسود غامق)
const leftBlack: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: "#000000",
  lineHeight: 1.25,
};

/* ✅ أسفل الخط: سطر واحد (العنوان + البيانات بجنبه) */
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
  opacity: 0.6,
};
