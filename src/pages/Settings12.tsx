import React, {useEffect, useMemo, useRef, useState} from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useAuth } from "../auth/AuthContext";
import { loadTenantSettings, saveTenantSettings } from "../services/tenantData";

const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const CONTROL_HEAD_NAME_KEY = "exam-manager:control-head-name:v1";

/**
 * Cloud document for Diploma Exam Center settings.
 * This separates Diploma Center settings from regular school Settings.tsx.
 */
const DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID = "diplomaExamCenter";
const LEGACY_EXAM_CENTER_SETTINGS_DOC_ID = "examCenter";
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

type ExamCenterData = {
  name: string;
  examCenterCode: string;
  centerCode?: string;
  governorate: string;
  semester: string;
  phone: string;
  address: string;
  controlHeadName: string;
  academicYear?: string;
};

type ExamCenterCloudSettings = Partial<ExamCenterData> & {
  logo?: string;
  updatedAtISO?: string;
};

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getTenantIdFromAuth(auth: any) {
  return (
    String(
      auth?.effectiveTenantId ||
        auth?.profile?.tenantId ||
        auth?.userProfile?.tenantId ||
        auth?.user?.tenantId ||
        "default"
    ).trim() || "default"
  );
}

function normalizeExamCenterData(value: Partial<ExamCenterData> | null | undefined): ExamCenterData {
  const examCenterCode = String(value?.examCenterCode || value?.centerCode || "").trim();

  return {
    name: String(value?.name || "").trim(),
    examCenterCode,
    centerCode: examCenterCode,
    governorate: String(value?.governorate || "").trim(),
    semester: String(value?.semester || "").trim(),
    phone: String(value?.phone || "").trim(),
    address: String(value?.address || "").trim(),
    controlHeadName: String(value?.controlHeadName || localStorage.getItem(CONTROL_HEAD_NAME_KEY) || "").trim(),
    academicYear: String(value?.academicYear || "").trim(),
  };
}

function getAcademicYearFromSystemDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
}

export default function Settings12() {
  const { lang, isRTL } = useI18n();
  const auth = useAuth() as any;
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const tenantId = useMemo(() => getTenantIdFromAuth(auth), [auth]);
  const currentUserId = String(auth?.user?.email || auth?.user?.uid || "").trim();

  const governorates = GOVERNORATES[lang];
  const semesters = SEMESTERS[lang];

  const [data, setData] = useState<ExamCenterData>({
    name: "",
    examCenterCode: "",
    centerCode: "",
    governorate: "",
    semester: "",
    phone: "",
    address: "",
    controlHeadName: "",
    academicYear: "",
  });
  const [logo, setLogo] = useState<string>(DEFAULT_LOGO_URL);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  
  const settings12CloudLoadedRef = useRef(false);
  const settings12LastSavedSignatureRef = useRef("");
useEffect(() => {
    let mounted = true;

    const savedLocalData = safeParseJson<Partial<ExamCenterData>>(
      localStorage.getItem(EXAM_CENTER_DATA_KEY),
      {}
    );
    const savedLocalLogo = localStorage.getItem(EXAM_CENTER_LOGO_KEY);

    if (Object.keys(savedLocalData || {}).length) {
      setData(normalizeExamCenterData(savedLocalData));
    } else {
      const storedControlHead = String(localStorage.getItem(CONTROL_HEAD_NAME_KEY) || "");
      if (storedControlHead) {
        setData((prev) => ({ ...prev, controlHeadName: storedControlHead }));
      }
    }

    if (savedLocalLogo) setLogo(savedLocalLogo);

    async function loadCloudSettings() {
      setIsCloudLoading(true);
      setSyncMessage(tr("جاري تحميل بيانات مركز الدبلوم من السحابة...", "Loading diploma center data from cloud..."));

      try {
        let cloud = await loadTenantSettings<ExamCenterCloudSettings>(
          tenantId,
          DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
          {}
        );

        let loadedFromLegacyDoc = false;

        const hasDiplomaCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.logo
        );

        if (!hasDiplomaCloudData) {
          const legacyCloud = await loadTenantSettings<ExamCenterCloudSettings>(
            tenantId,
            LEGACY_EXAM_CENTER_SETTINGS_DOC_ID,
            {}
          );

          const hasLegacyCloudData = Boolean(
            legacyCloud?.name ||
              legacyCloud?.examCenterCode ||
              legacyCloud?.centerCode ||
              legacyCloud?.governorate ||
              legacyCloud?.semester ||
              legacyCloud?.phone ||
              legacyCloud?.address ||
              legacyCloud?.controlHeadName ||
              legacyCloud?.logo
          );

          if (hasLegacyCloudData) {
            cloud = legacyCloud;
            loadedFromLegacyDoc = true;
          }
        }

        if (!mounted) return;

        const hasCloudData = Boolean(
          cloud?.name ||
            cloud?.examCenterCode ||
            cloud?.centerCode ||
            cloud?.governorate ||
            cloud?.semester ||
            cloud?.phone ||
            cloud?.address ||
            cloud?.controlHeadName ||
            cloud?.logo
        );

        if (hasCloudData) {
          const nextData = normalizeExamCenterData(cloud);
          const nextLogo = String(cloud.logo || savedLocalLogo || DEFAULT_LOGO_URL);

          setData(nextData);
          setLogo(nextLogo);

          localStorage.setItem(EXAM_CENTER_DATA_KEY, JSON.stringify(nextData));
          localStorage.setItem(EXAM_CENTER_LOGO_KEY, nextLogo);
          localStorage.setItem(CONTROL_HEAD_NAME_KEY, String(nextData.controlHeadName || "").trim());

          window.dispatchEvent(new Event("exam-manager:changed"));
          window.dispatchEvent(new Event("exam-manager:control-head-changed"));

          if (loadedFromLegacyDoc) {
            await saveTenantSettings(
              tenantId,
              DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
              {
                ...nextData,
                centerCode: nextData.examCenterCode,
                academicYear: nextData.academicYear || getAcademicYearFromSystemDate(new Date()),
                logo: nextLogo,
                updatedAtISO: new Date().toISOString(),
              },
              { by: currentUserId || undefined }
            );

            setSyncMessage(
              tr(
                "تم تحميل بيانات المركز القديمة وترحيلها إلى مسار مركز الدبلوم.",
                "Legacy center data loaded and migrated to the diploma center path."
              )
            );
          } else {
            setSyncMessage(tr("تم تحميل بيانات مركز الدبلوم من السحابة.", "Diploma center data loaded from cloud."));
          }
        } else if (Object.keys(savedLocalData || {}).length || savedLocalLogo) {
          const localData = normalizeExamCenterData(savedLocalData);
          const localLogo = String(savedLocalLogo || DEFAULT_LOGO_URL);

          await saveTenantSettings(
            tenantId,
            DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID,
            {
              ...localData,
              centerCode: localData.examCenterCode,
              academicYear: localData.academicYear || getAcademicYearFromSystemDate(new Date()),
              logo: localLogo,
              updatedAtISO: new Date().toISOString(),
            },
            { by: currentUserId || undefined }
          );

          setSyncMessage(tr("تم ترحيل بيانات هذا الجهاز إلى السحابة.", "Local center data migrated to cloud."));
        } else {
          setSyncMessage(tr("لا توجد بيانات مركز محفوظة بعد.", "No saved center data yet."));
        }
      } catch (error) {
        if (!mounted) return;
        setSyncMessage(tr("تعذر تحميل السحابة؛ يتم عرض نسخة الجهاز المؤقتة.", "Could not load cloud data; showing local cache."));
      } finally {
        if (mounted) setIsCloudLoading(false);
      }
    }

    void loadCloudSettings();

    return () => {
      mounted = false;
    };
  }, [tenantId, currentUserId, lang]);

  const handleChange = (field: keyof ExamCenterData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const saveData = async () => {
    const normalizedData = normalizeExamCenterData({
      ...data,
      centerCode: data.examCenterCode || data.centerCode,
      academicYear,
    });

    const payload: ExamCenterCloudSettings = {
      ...normalizedData,
      centerCode: normalizedData.examCenterCode,
      academicYear,
      logo,
      updatedAtISO: new Date().toISOString(),
    };

    setIsSaving(true);
    setSyncMessage(tr("جاري حفظ بيانات مركز الدبلوم في السحابة...", "Saving diploma center data to cloud..."));

    localStorage.setItem(EXAM_CENTER_DATA_KEY, JSON.stringify(normalizedData));
    localStorage.setItem(EXAM_CENTER_LOGO_KEY, logo);
    localStorage.setItem(CONTROL_HEAD_NAME_KEY, String(normalizedData.controlHeadName || "").trim());

    window.dispatchEvent(new Event("exam-manager:changed"));
    window.dispatchEvent(new Event("exam-manager:control-head-changed"));

    try {
      await saveTenantSettings(tenantId, DIPLOMA_EXAM_CENTER_SETTINGS_DOC_ID, payload, { by: currentUserId || undefined });
      setSyncMessage(tr("تم حفظ بيانات مركز الدبلوم في السحابة بنجاح.", "Diploma center data saved to cloud successfully."));
      alert(tr("تم حفظ بيانات مركز الدبلوم في السحابة بنجاح.", "Diploma exam center data saved to cloud successfully."));
    } catch (error) {
      setSyncMessage(tr("تم الحفظ على هذا الجهاز فقط، وتعذر الحفظ في السحابة.", "Saved locally only; cloud save failed."));
      alert(
        tr(
          "تم حفظ البيانات على هذا الجهاز فقط، لكن تعذر رفعها إلى السحابة. تحقق من الاتصال والصلاحيات.",
          "Data was saved on this device only, but cloud upload failed. Check connection and permissions."
        )
      );
    } finally {
      setIsSaving(false);
    }
  };

  const academicYear = useMemo(() => data.academicYear || getAcademicYearFromSystemDate(new Date()), [data.academicYear]);

  const previewGov = data.governorate?.trim() || tr("المحافظة / المديرية", "Governorate / Directorate");
  const previewCenter = data.name?.trim() || tr("اسم مركز الامتحانات", "Exam Center Name");
  const previewCenterCode = data.examCenterCode?.trim() || data.centerCode?.trim() || tr("رمز مركز الامتحان", "Exam Center Code");
  const previewSemester = data.semester?.trim() || tr("الفصل الدراسي", "Semester");
  const previewPhone = data.phone?.trim() || tr("رقم الهاتف", "Phone Number");
  const previewAddress = data.address?.trim() || tr("العنوان", "Address");
  const previewControlHead = data.controlHeadName?.trim() || tr("اسم رئيس الكنترول", "Control Head Name");

  const uploadLogo = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setLogo(value);
    };
    reader.readAsDataURL(file);
  };

  return (
    
    <div className="settings12PageRoot" style={{ ...pageWrap, direction: isRTL ? "rtl" : "ltr" }}>
      <style>{`
        html,
        body,
        #root {
          margin: 0 !important;
          min-height: 100% !important;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        body {
          background-color: #f7f3e7 !important;
        }

        .settings12PageRoot {
          position: relative;
          z-index: 1;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }

        .settingsFixedLightBg {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(1200px 520px at 50% -10%, rgba(212, 175, 55, 0.18), transparent 62%),
            linear-gradient(180deg, #fffdf7 0%, #f7f3e7 48%, #fffaf0 100%) !important;
        }
      `}</style>
      <div className="settingsFixedLightBg" aria-hidden="true" />

      <div style={shellStyle}>
        <section style={heroCardStyle}>
          <div style={heroGridStyle}>
            <div style={previewPanelStyle}>
              <div style={innerPreviewPanelStyle}>
                <div style={topBadgeStyle}>{tr("واجهة تشغيل مخصصة", "Dedicated Operating View")}</div>

                <div style={heroTitleWrapStyle}>
                  <h1 style={heroTitleStyle}>
                    {tr("مركز امتحان دبلوم التعليم العام وما في مستواه", "General Education Diploma Exam Center")}
                  </h1>
                  <div style={heroSubTitleStyle}>{tr("لوحة تحكم مركز الامتحانات", "Exam Center Control Panel")}</div>
                </div>

                <p style={heroTextStyle}>
                  {tr(
                    "هذه الصفحة تضبط بيانات مركز الامتحانات الرسمية بنفس الهوية المعتمدة لصفحات الدبلوم، بحيث تظهر جميع العناصر بخلفية فاتحة وحدود ذهبية وخط أسود عريض واضح.",
                    "This page configures the official exam center data using the same approved diploma visual identity, so every element appears with a light background, bold golden borders, and clear black text."
                  )}
                </p>
              </div>

              <div style={statsShellStyle}>
                {[
                  { label: tr("المستخدم الحالي", "Current User"), value: previewCenter !== tr("اسم مركز الامتحانات", "Exam Center Name") ? previewCenter : "Yra Aa" },
                  { label: tr("لغة الواجهة", "Interface Language"), value: lang === "ar" ? "العربية" : "English" },
                  { label: tr("حالة الجهة", "Entity Status"), value: tr("مرتبطة", "Linked") },
                ].map((item) => (
                  <div key={item.label} style={statCardStyle}>
                    <div style={statLabelStyle}>{item.label}</div>
                    <div style={statValueStyle}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={contentCardStyle}>
          <div style={sectionTitleWrapStyle}>
            <div style={greenPillStyle}>{tr("إعداد البيانات الرسمية", "Official Data Setup")}</div>
            <h2 style={sectionTitleStyle}>{tr("بيانات مركز الامتحانات", "Exam Center Information")}</h2>
            <p style={sectionDescriptionStyle}>
              {tr(
                "أدخل البيانات الرسمية التي ستظهر في الترويسة والتقارير والمخرجات المطبوعة الخاصة بمركز الامتحانات.",
                "Enter the official data that will appear in the header, reports, and printed outputs for the exam center."
              )}
            </p>
          </div>

          <div style={formGridStyle}>
            <FieldCard label={tr("اسم مركز الامتحانات", "Exam Center Name")}>
              <input
                value={data.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={tr("اكتب اسم المركز", "Enter exam center name")}
                style={inputStyle}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("رمز مركز الامتحان", "Exam Center Code")}>
              <input
                value={data.examCenterCode}
                onChange={(e) => handleChange("examCenterCode", e.target.value)}
                placeholder={tr("اكتب رمز مركز الامتحان", "Enter exam center code")}
                style={inputStyle}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("المحافظة / المديرية", "Governorate / Directorate")}>
              <select
                value={data.governorate}
                onChange={(e) => handleChange("governorate", e.target.value)}
                style={selectStyle}
                className="settings12-field settings12-select"
              >
                <option value="">{tr("اختر المحافظة / المديرية", "Select governorate / directorate")}</option>
                {governorates.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FieldCard>

            <FieldCard label={tr("الفصل الدراسي", "Semester")}>
              <select
                value={data.semester}
                onChange={(e) => handleChange("semester", e.target.value)}
                style={selectStyle}
                className="settings12-field settings12-select"
              >
                <option value="">{tr("اختر الفصل الدراسي", "Select semester")}</option>
                {semesters.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </FieldCard>

            <FieldCard label={tr("رقم الهاتف", "Phone Number")}>
              <input
                value={data.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder={tr("اكتب رقم الهاتف", "Enter phone number")}
                style={inputStyle}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("اسم رئيس الكنترول", "Control Head Name")}>
              <input
                value={data.controlHeadName}
                onChange={(e) => handleChange("controlHeadName", e.target.value)}
                placeholder={tr("اكتب اسم رئيس الكنترول", "Enter control head name")}
                style={inputStyle}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("العنوان", "Address")} fullWidth>
              <textarea
                value={data.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder={tr("اكتب العنوان الرسمي لمركز الامتحانات", "Enter the official exam center address")}
                style={textAreaStyle}
                className="settings12-field"
              />
            </FieldCard>

            <FieldCard label={tr("شعار المركز", "Center Logo")} fullWidth>
              <div style={logoUploadWrapStyle}>
                <div style={logoPreviewBoxStyle}>
                  <img src={logo || DEFAULT_LOGO_URL} alt="logo" style={logoImageStyle} />
                </div>

                <div style={{ display: "grid", gap: 12, flex: 1 }}>
                  <label style={uploadButtonStyle}>
                    {tr("اختيار شعار", "Choose Logo")}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadLogo(e.target.files?.[0] || null)}
                      style={{ display: "none" }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setLogo(DEFAULT_LOGO_URL)}
                    style={secondaryButtonStyle}
                  >
                    {tr("استعادة الشعار الافتراضي", "Restore Default Logo")}
                  </button>
                </div>
              </div>
            </FieldCard>
          </div>

          <div style={sectionTitleWrapStyle}>
            <div style={greenPillStyle}>{tr("معاينة فورية", "Instant Preview")}</div>
            <h2 style={sectionTitleStyle}>{tr("شكل البيانات بعد الحفظ", "How the Data Looks After Saving")}</h2>
          </div>

          <div style={previewDocumentShellStyle}>
            <div style={previewHeaderStyle}>
              <div style={previewHeaderTextStyle}>
                <div style={previewGovTitleStyle}>سلطنة عمان</div>
                <div style={previewGovLineStyle}>وزارة  والتعليم</div>
                <div style={previewGovLineStyle}>{previewGov}</div>
                <div style={previewSchoolTitleStyle}>{previewCenter}</div>
              </div>
              <img src={logo || DEFAULT_LOGO_URL} alt="preview logo" style={previewLogoStyle} />
            </div>

            <div style={previewMetaGridStyle}>
              <MetaCard label={tr("رمز مركز الامتحان", "Exam Center Code")} value={previewCenterCode} />
              <MetaCard label={tr("الفصل الدراسي", "Semester")} value={previewSemester} />
              <MetaCard label={tr("العام الدراسي", "Academic Year")} value={academicYear} />
              <MetaCard label={tr("الهاتف", "Phone")} value={previewPhone} />
              <MetaCard label={tr("اسم رئيس الكنترول", "Control Head Name")} value={previewControlHead} />
            </div>

            <div style={previewTextCardStyle}>
              <div style={metaLabelStyle}>{tr("العنوان الرسمي", "Official Address")}</div>
              <div style={metaValueStyle}>{previewAddress}</div>
            </div>
          </div>

          <div style={syncStatusStyle}>
            {isCloudLoading ? tr("تحميل من السحابة...", "Loading from cloud...") : syncMessage}
          </div>

          <div style={actionRowStyle}>
            <button type="button" onClick={saveData} style={primaryButtonStyle} disabled={isSaving}>
              {isSaving
                ? tr("جاري الحفظ...", "Saving...")
                : tr("حفظ بيانات مركز الامتحانات", "Save Exam Center Data")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function FieldCard({
  label,
  children,
  fullWidth = false,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      style={{
        ...fieldCardStyle,
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaCardStyle}>
      <div style={metaLabelStyle}>{label}</div>
      <div style={metaValueStyle}>{value}</div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: "18px",
  background: "linear-gradient(180deg, #f3efe4 0%, #ece7d8 100%)",
  boxSizing: "border-box",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1880,
  margin: "0 auto",
  display: "grid",
  gap: 24,
};

const sharedCardBase: React.CSSProperties = {
  background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
  border: "5px solid #d4af37",
  borderRadius: 40,
  boxShadow: "0 0 0 10px rgba(212,175,55,0.12) inset, 0 18px 38px rgba(150,120,20,0.14)",
};

const heroCardStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 28,
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
};

const previewPanelStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 28,
};

const innerPreviewPanelStyle: React.CSSProperties = {
  ...sharedCardBase,
  borderWidth: 4,
  padding: 28,
  display: "grid",
  gap: 20,
};

const topBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  marginInlineStart: "auto",
  padding: "12px 26px",
  borderRadius: 999,
  background: "linear-gradient(180deg, #ebf3ff 0%, #dce9ff 100%)",
  border: "4px solid #d4af37",
  color: "#000",
  fontWeight: 900,
  fontSize: 20,
  boxShadow: "0 10px 22px rgba(40,70,120,0.08)",
};

const heroTitleWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#000",
  fontWeight: 1000,
  fontSize: "clamp(36px, 5vw, 72px)",
  lineHeight: 1.18,
  textShadow: "0 10px 22px rgba(212,175,55,0.10)",
};

const heroSubTitleStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 900,
  fontSize: 26,
};

const heroTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#000",
  fontWeight: 800,
  fontSize: 18,
  lineHeight: 2,
};

const statsShellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 20,
};

const statCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #f8f4e8 0%, #f2eddf 100%)",
  border: "4px solid #d4af37",
  borderRadius: 30,
  padding: "24px 28px",
  boxShadow: "0 12px 28px rgba(150,120,20,0.10)",
  display: "grid",
  gap: 8,
};

const statLabelStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 900,
  fontSize: 18,
};

const statValueStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 24,
};

const contentCardStyle: React.CSSProperties = {
  ...sharedCardBase,
  padding: 28,
  display: "grid",
  gap: 28,
};

const sectionTitleWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const greenPillStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  padding: "10px 18px",
  borderRadius: 999,
  border: "2px solid rgba(16,185,129,0.25)",
  background: "rgba(16,185,129,0.10)",
  color: "#000",
  fontWeight: 900,
  fontSize: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#000",
  fontWeight: 1000,
  fontSize: "clamp(24px, 3vw, 38px)",
};

const sectionDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#000",
  fontWeight: 800,
  fontSize: 17,
  lineHeight: 1.9,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 22,
};

const fieldCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #faf7ee 0%, #f5f0e1 100%)",
  border: "4px solid #d4af37",
  borderRadius: 30,
  padding: 22,
  boxShadow: "0 10px 24px rgba(150,120,20,0.08)",
  display: "grid",
  gap: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 20,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 64,
  borderRadius: 22,
  border: "3px solid #d4af37",
  background: "#f8f4e8",
  color: "#000000",
  fontWeight: 1000,
  fontSize: 24,
  padding: "14px 20px",
  outline: "none",
  boxSizing: "border-box",
  WebkitTextFillColor: "#000000",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  MozAppearance: "none" as const,
  cursor: "pointer",
};

const textAreaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 160,
  borderRadius: 24,
  border: "3px solid #d4af37",
  background: "#f8f4e8",
  color: "#000000",
  fontWeight: 1000,
  fontSize: 22,
  padding: "18px 20px",
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical" as const,
  WebkitTextFillColor: "#000000",
};

const logoUploadWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
};

const logoPreviewBoxStyle: React.CSSProperties = {
  width: 130,
  height: 130,
  borderRadius: 30,
  background: "#fff",
  border: "4px solid #d4af37",
  display: "grid",
  placeItems: "center",
  boxShadow: "0 10px 20px rgba(150,120,20,0.10)",
};

const logoImageStyle: React.CSSProperties = {
  width: "78%",
  height: "78%",
  objectFit: "contain",
};

const uploadButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 56,
  width: "fit-content",
  padding: "0 24px",
  borderRadius: 18,
  border: "3px solid #d4af37",
  background: "linear-gradient(180deg, #e9f1ff 0%, #d8e7ff 100%)",
  color: "#000",
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(40,70,120,0.08)",
};

const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 56,
  width: "fit-content",
  padding: "0 24px",
  borderRadius: 18,
  border: "3px solid #d4af37",
  background: "#fffdf7",
  color: "#000",
  fontWeight: 1000,
  fontSize: 18,
  cursor: "pointer",
};

const previewDocumentShellStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #faf7ee 0%, #f5f0e1 100%)",
  border: "4px solid #d4af37",
  borderRadius: 34,
  padding: 26,
  display: "grid",
  gap: 24,
  boxShadow: "0 12px 28px rgba(150,120,20,0.10)",
};

const previewHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const previewHeaderTextStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const previewGovTitleStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 24,
};

const previewGovLineStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 900,
  fontSize: 18,
};

const previewSchoolTitleStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 30,
};

const previewLogoStyle: React.CSSProperties = {
  width: 100,
  height: 100,
  objectFit: "contain",
};

const previewMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 18,
};

const metaCardStyle: React.CSSProperties = {
  background: "#f8f4e8",
  border: "3px solid #d4af37",
  borderRadius: 24,
  padding: 18,
  display: "grid",
  gap: 8,
};

const metaLabelStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 900,
  fontSize: 16,
};

const metaValueStyle: React.CSSProperties = {
  color: "#000",
  fontWeight: 1000,
  fontSize: 20,
  lineHeight: 1.6,
};

const previewTextCardStyle: React.CSSProperties = {
  background: "#f8f4e8",
  border: "3px solid #d4af37",
  borderRadius: 24,
  padding: 20,
  display: "grid",
  gap: 10,
};

const syncStatusStyle: React.CSSProperties = {
  border: "3px solid #d4af37",
  borderRadius: 20,
  background: "#fffdf7",
  padding: "14px 18px",
  color: "#000",
  fontWeight: 1000,
  fontSize: 16,
  textAlign: "center",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 62,
  minWidth: 320,
  padding: "0 28px",
  borderRadius: 22,
  border: "4px solid #d4af37",
  background: "linear-gradient(180deg, #f2dc8a 0%, #d4af37 100%)",
  color: "#000",
  fontWeight: 1000,
  fontSize: 22,
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(150,120,20,0.18)",
};
