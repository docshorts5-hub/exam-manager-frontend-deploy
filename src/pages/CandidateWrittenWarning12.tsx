import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { tenantPath } from "../config/tenantRoutes";
import { db } from "../firebase/firebase";

type Lang = "ar" | "en";

type OfficialHeader = {
  country: string;
  ministry: string;
  directorate: string;
  committee: string;
  governorate: string;
  centerName: string;
  academicYear: string;
  semester: string;
  logoUrl: string;
};

type WrittenWarningForm = {
  academicYear: string;
  round: string;
  semester: string;
  candidateName: string;
  civilNo: string;
  seatNo: string;
  schoolName: string;
  centerName: string;
  subject: string;
  day: string;
  date: string;
  warningHour: string;
  warningMinute: string;
  violationIds: string[];
  otherViolation: string;
  candidateSignature: string;
  reporterName: string;
  reporterEmployeeNo: string;
  reporterSignature: string;
  centerHeadName: string;
  centerHeadEmployeeNo: string;
  centerHeadSignature: string;
};

type SavedWarningRow = {
  id: string;
  savedAtISO: string;
  candidateName: string;
  seatNo: string;
  subject: string;
  centerName: string;
  status: "complete" | "draft";
  form: WrittenWarningForm;
};

const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const APP_LOGO_KEY = "exam-manager:app-logo";

const GOLD = "#b58b16";
const GOLD_DARK = "#7c5d00";
const GOLD_SOFT = "#d7bd63";
const BLACK = "#111827";
const MUTED = "#4b5563";
const LINE = "#111827";
const PAGE_BG =
  "radial-gradient(900px 420px at 50% -10%, rgba(212,175,55,.22), transparent 60%), linear-gradient(180deg, #fffdf7 0%, #f6efe0 52%, #fffaf0 100%)";

const warningOptions = [
  {
    id: "uniform",
    label: "عدم الالتزام بالزي المنصوص عليه في المادة (19) من القرار الوزاري رقم (588 / 2015).",
  },
  {
    id: "late",
    label: "التأخر عن دخول قاعة الامتحان لمدة تزيد عن عشر دقائق عن بدء الامتحان.",
  },
  {
    id: "identity",
    label: "عدم إحضار أصل إثبات الهوية (البطاقة الشخصية / جواز السفر / رخصة القيادة).",
  },
  {
    id: "seat",
    label: "الإصرار على عدم التقيد بالمكان المخصص له في قاعة الامتحان.",
  },
  {
    id: "bookNumbering",
    label: "العبث بالترقيم الآلي في دفتر الامتحان.",
  },
  {
    id: "other",
    label: "أخرى (تحدد).",
  },
];

const defaultForm = (header?: Partial<OfficialHeader>): WrittenWarningForm => {
  const deviceDate = getDeviceDateParts();
  return {
    academicYear: header?.academicYear || getAcademicYear(),
    round: "",
    semester: header?.semester || "",
    candidateName: "",
    civilNo: "",
    seatNo: "",
    schoolName: "",
    centerName: header?.centerName || "",
    subject: "",
    day: deviceDate.day,
    date: deviceDate.date,
    warningHour: deviceDate.hour,
    warningMinute: deviceDate.minute,
    violationIds: [],
    otherViolation: "",
    candidateSignature: "",
    reporterName: "",
    reporterEmployeeNo: "",
    reporterSignature: "",
    centerHeadName: "",
    centerHeadEmployeeNo: "",
    centerHeadSignature: "",
  };
};

function safeReadJson<T>(key: string): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
}

function getAcademicYear(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 9 ? year : year - 1;
  return `${start} / ${start + 1}`;
}

function formatDeviceDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function getDeviceDateParts() {
  const now = new Date();
  return {
    day: new Intl.DateTimeFormat("ar", { weekday: "long" }).format(now),
    date: formatDeviceDate(now),
    hour: String(now.getHours()).padStart(2, "0"),
    minute: String(now.getMinutes()).padStart(2, "0"),
  };
}

function normalizeDirectorate(value: string, governorate: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text) return text;
  if (governorate) return `المديرية العامة للتعليم بمحافظة ${governorate}`;
  return "المديرية العامة للتعليم";
}

function buildHeader(lang: Lang): OfficialHeader {
  const payload = safeReadJson<Record<string, any>>(EXAM_CENTER_DATA_KEY) || {};

  const governorate = firstText(
    payload.governorate,
    payload.directorateGovernorate,
    payload.regionAr,
    payload.region,
    payload.governorateName,
  );

  const rawDirectorate = firstText(
    payload.directorateName,
    payload.educationDirectorate,
    payload.generalDirectorate,
    payload.directorate,
    governorate,
  );

  const directorate = normalizeDirectorate(rawDirectorate, governorate);

  const committee = firstText(
    payload.examCommitteeName,
    payload.committeeName,
    payload.committee,
    governorate ? `لجنة إدارة الامتحانات بمحافظة ${governorate}` : "لجنة إدارة الامتحانات",
  );

  const logo = firstText(
    typeof window !== "undefined" ? window.localStorage.getItem(EXAM_CENTER_LOGO_KEY) : "",
    typeof window !== "undefined" ? window.localStorage.getItem(APP_LOGO_KEY) : "",
    payload.logoUrl,
    payload.logo,
    DEFAULT_LOGO_URL,
  );

  const centerName = firstText(
    payload.name,
    payload.centerName,
    payload.examCenterName,
    payload.controlCenterName,
    payload.schoolName,
    "مركز امتحان دبلوم التعليم العام",
  );

  return {
    country: firstText(payload.country, payload.countryName, payload.sultanate, lang === "ar" ? "سلطنة عمان" : "Sultanate of Oman"),
    ministry: firstText(payload.ministry, payload.ministryName, payload.educationMinistry, lang === "ar" ? "وزارة التربية والتعليم" : "Ministry of Education"),
    directorate,
    committee,
    governorate,
    centerName,
    academicYear: firstText(payload.academicYear, payload.yearLabel, payload.schoolYear, payload.studyYear, payload.academicYearLabel, getAcademicYear()),
    semester: firstText(payload.semester, payload.term, payload.studyTerm, payload.termName, ""),
    logoUrl: logo,
  };
}

function inputStyle(multiline = false): React.CSSProperties {
  return {
    width: "100%",
    minHeight: multiline ? 64 : 34,
    border: "1.5px solid rgba(17,24,39,.28)",
    borderRadius: 10,
    padding: multiline ? "8px 10px" : "7px 10px",
    background: "#ffffff",
    color: BLACK,
    fontWeight: 800,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    resize: multiline ? "vertical" : undefined,
  };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 4, color: BLACK, fontWeight: 900, fontSize: 12 }}>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle(true)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle()} />
      )}
    </label>
  );
}

function FormLine({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <div className={wide ? "print-line wide" : "print-line"}>
      <span className="print-line-label">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="section-title">{children}</h3>;
}

function setField<K extends keyof WrittenWarningForm>(setForm: React.Dispatch<React.SetStateAction<WrittenWarningForm>>, key: K, value: WrittenWarningForm[K]) {
  setForm((prev) => ({ ...prev, [key]: value }));
}

function toggleInArray(values: string[], id: string) {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
}

function readAuthEmail(auth: any) {
  return firstText(auth?.user?.email, auth?.currentUser?.email, auth?.profile?.email, auth?.userProfile?.email);
}

function getFormStatus(form: WrittenWarningForm): "complete" | "draft" {
  return form.candidateName.trim() && form.seatNo.trim() && form.subject.trim() ? "complete" : "draft";
}

function formatDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeSavedDate(value: any) {
  try {
    if (value?.toDate) return formatDateTime(value.toDate());
    if (typeof value === "string" && value.trim()) return formatDateTime(new Date(value));
  } catch {
    // keep fallback below
  }
  return formatDateTime(new Date());
}

function getWarningsCollectionRef(tenantId: string) {
  return collection(db, "tenants", tenantId, "candidateWrittenWarnings12");
}

function getWarningDocRef(tenantId: string, id: string) {
  return doc(db, "tenants", tenantId, "candidateWrittenWarnings12", id);
}

function buildSavedRow(id: string, data: any, fallbackForm?: WrittenWarningForm): SavedWarningRow {
  const form = { ...defaultForm(), ...(fallbackForm || {}), ...(data?.form || {}) } as WrittenWarningForm;
  return {
    id,
    savedAtISO: data?.savedAtISO || normalizeSavedDate(data?.savedAt || data?.updatedAt),
    candidateName: firstText(form.candidateName, data?.candidateName, "-"),
    seatNo: firstText(form.seatNo, data?.seatNo, "-"),
    subject: firstText(form.subject, data?.subject, "-"),
    centerName: firstText(form.centerName, data?.centerName, "-"),
    status: (data?.status === "complete" ? "complete" : "draft") as "complete" | "draft",
    form,
  };
}

const pageShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: PAGE_BG,
  color: BLACK,
  padding: "20px 12px 36px",
  boxSizing: "border-box",
  direction: "rtl",
};

const actionBarStyle: React.CSSProperties = {
  maxWidth: 1420,
  margin: "0 auto 16px",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  background: "rgba(255,250,240,.96)",
  border: `1.5px solid ${GOLD_SOFT}`,
  borderRadius: 18,
  padding: 12,
  boxShadow: "0 10px 26px rgba(92,64,0,.10)",
};

function buttonStyle(bg = "linear-gradient(180deg, #fff8df, #ead28a)"): React.CSSProperties {
  return {
    border: `1.5px solid ${GOLD}`,
    background: bg,
    color: BLACK,
    fontWeight: 900,
    borderRadius: 12,
    padding: "10px 14px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(92,64,0,.10)",
  };
}

export default function CandidateWrittenWarning12() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { tenantId: routeTenantId } = useParams();
  const { lang } = useI18n();
  const safeLang: Lang = lang === "en" ? "en" : "ar";
  const tenantId = firstText(routeTenantId, auth?.effectiveTenantId, auth?.profile?.tenantId, auth?.userProfile?.tenantId, auth?.user?.tenantId);
  const header = useMemo(() => buildHeader(safeLang), [safeLang]);
  const [form, setForm] = useState<WrittenWarningForm>(() => defaultForm(header));
  const [savedRows, setSavedRows] = useState<SavedWarningRow[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSavedRows, setLoadingSavedRows] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    const deviceDate = getDeviceDateParts();
    setForm((prev) => ({
      ...prev,
      academicYear: prev.academicYear || header.academicYear,
      semester: prev.semester || header.semester,
      centerName: prev.centerName || header.centerName,
      day: prev.day || deviceDate.day,
      date: prev.date || deviceDate.date,
      warningHour: prev.warningHour || deviceDate.hour,
      warningMinute: prev.warningMinute || deviceDate.minute,
    }));
  }, [header.academicYear, header.semester, header.centerName]);


  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;

    const loadSavedWarnings = async () => {
      try {
        setLoadingSavedRows(true);
        const snapshot = await getDocs(query(getWarningsCollectionRef(tenantId), limit(30)));
        if (cancelled) return;

        const rows = snapshot.docs
          .map((item) => buildSavedRow(item.id, item.data()))
          .sort((a, b) => String(b.savedAtISO).localeCompare(String(a.savedAtISO), "ar"));

        setSavedRows(rows);
      } catch (error: any) {
        if (!cancelled) {
          setMessage(`تعذر تحميل سجل الإنذارات المحفوظة: ${error?.code ? `${error.code}: ` : ""}${error?.message || String(error)}`);
        }
      } finally {
        if (!cancelled) setLoadingSavedRows(false);
      }
    };

    void loadSavedWarnings();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const selectedViolationText = warningOptions
    .filter((option) => form.violationIds.includes(option.id))
    .map((option) => option.id === "other" && form.otherViolation.trim() ? `${option.label} ${form.otherViolation}` : option.label)
    .join("، ");

  const fillCenterData = () => {
    const deviceDate = getDeviceDateParts();
    setForm((prev) => ({
      ...prev,
      academicYear: prev.academicYear || header.academicYear,
      semester: prev.semester || header.semester,
      centerName: prev.centerName || header.centerName,
      date: deviceDate.date,
      day: deviceDate.day,
      warningHour: deviceDate.hour,
      warningMinute: deviceDate.minute,
    }));
  };

  const resetForm = () => {
    if (!window.confirm("سيتم تفريغ النموذج الحالي. هل تريد المتابعة؟")) return;
    setForm(defaultForm(header));
    setEditingId("");
    setMessage("");
  };

  const handlePrint = () => {
    window.print();
  };

  const saveToCloud = async () => {
    if (!tenantId) {
      setMessage("تعذر الحفظ: لا يوجد نطاق مركز امتحان واضح في الرابط.");
      return;
    }

    const status = getFormStatus(form);
    if (status === "draft") {
      const ok = window.confirm("البيانات الأساسية غير مكتملة. هل تريد حفظ الإنذار كمسودة؟");
      if (!ok) return;
    }

    try {
      setSaving(true);
      const payload = {
        type: "candidateWrittenWarning12",
        status,
        form,
        officialHeader: header,
        selectedViolationText,
        tenantId,
        savedBy: readAuthEmail(auth),
        updatedAt: serverTimestamp(),
        printable: {
          paper: "A4",
          orientation: "portrait",
          headerOnlyFirstPage: true,
        },
      };

      if (editingId) {
        await updateDoc(getWarningDocRef(tenantId, editingId), payload);
        const row = buildSavedRow(
          editingId,
          {
            ...payload,
            updatedAt: new Date().toISOString(),
          },
          form,
        );
        setSavedRows((prev) => prev.map((item) => (item.id === editingId ? row : item)));
        setMessage(`تم تعديل سجل الإنذار الكتابي في السحابة بنجاح. رقم الحفظ: ${editingId}`);
        setEditingId("");
        return;
      }

      const ref = await addDoc(getWarningsCollectionRef(tenantId), {
        ...payload,
        savedAt: serverTimestamp(),
      });
      const row = buildSavedRow(
        ref.id,
        {
          ...payload,
          savedAt: new Date().toISOString(),
        },
        form,
      );
      setSavedRows((prev) => [row, ...prev].slice(0, 30));
      setMessage(`تم حفظ الإنذار الكتابي في التخزين السحابي بنجاح. رقم الحفظ: ${ref.id}`);
    } catch (error: any) {
      setMessage(`تعذر حفظ الإنذار في السحابة: ${error?.code ? `${error.code}: ` : ""}${error?.message || String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const editSavedWarning = (row: SavedWarningRow) => {
    setForm({ ...defaultForm(header), ...row.form });
    setEditingId(row.id);
    setMessage(`وضع التعديل مفعل للسجل رقم: ${row.id}. عدّل البيانات ثم اضغط حفظ التعديل في السحابة.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId("");
    setMessage("تم إلغاء وضع التعديل. يمكنك الآن إنشاء سجل جديد.");
  };

  const deleteSavedWarning = async (row: SavedWarningRow) => {
    if (!tenantId) {
      setMessage("تعذر الحذف: لا يوجد نطاق مركز امتحان واضح في الرابط.");
      return;
    }

    const ok = window.confirm(`سيتم حذف سجل الإنذار رقم ${row.id}. هل تريد المتابعة؟`);
    if (!ok) return;

    try {
      setDeletingId(row.id);
      await deleteDoc(getWarningDocRef(tenantId, row.id));
      setSavedRows((prev) => prev.filter((item) => item.id !== row.id));
      if (editingId === row.id) {
        setEditingId("");
        setForm(defaultForm(header));
      }
      setMessage(`تم حذف سجل الإنذار الكتابي من السحابة بنجاح. رقم الحفظ: ${row.id}`);
    } catch (error: any) {
      setMessage(`تعذر حذف السجل من السحابة: ${error?.code ? `${error.code}: ` : ""}${error?.message || String(error)}`);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div style={pageShellStyle}>
      <style>{PRINT_CSS}</style>

      <div className="no-print" style={actionBarStyle}>
        <div>
          <div style={{ fontSize: 13, color: GOLD_DARK, fontWeight: 900 }}>صفحة رسمية لمركز الامتحانات</div>
          <div style={{ fontSize: 26, fontWeight: 1000, color: BLACK }}>إنذار كتابي لممتحن</div>
          <div style={{ color: MUTED, fontWeight: 800, marginTop: 4 }}>نموذج مطابق للوثيقة الرسمية مع الطباعة والحفظ السحابي.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate(tenantPath(tenantId, "/control12"))} style={buttonStyle("linear-gradient(180deg, #e5e7eb, #d1d5db)")}>العودة للكنترول</button>
          <button type="button" onClick={fillCenterData} style={buttonStyle("linear-gradient(180deg, #dcfce7, #bbf7d0)")}>تحديث اليوم والتاريخ وبيانات المركز</button>
          <button type="button" onClick={saveToCloud} disabled={saving} style={buttonStyle("linear-gradient(180deg, #dbeafe, #bfdbfe)")}>{saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل في السحابة" : "حفظ الإنذار في السحابة"}</button>
          {editingId ? <button type="button" onClick={cancelEdit} style={buttonStyle("linear-gradient(180deg, #f3f4f6, #e5e7eb)")}>إلغاء التعديل</button> : null}
          <button type="button" onClick={handlePrint} style={buttonStyle("linear-gradient(180deg, #fef3c7, #f59e0b)")}>طباعة الإنذار / PDF</button>
          <button type="button" onClick={resetForm} style={buttonStyle("linear-gradient(180deg, #fee2e2, #fecaca)")}>تفريغ النموذج</button>
        </div>
      </div>

      {message ? <div className="no-print" style={{ ...actionBarStyle, color: BLACK, fontWeight: 900 }}>{message}</div> : null}

      <main className="print-root">
        <section className="a4-page warning-page">
          <div className="corner corner-top-right" />
          <div className="corner corner-top-left" />
          <div className="corner corner-bottom-right" />
          <div className="corner corner-bottom-left" />

          <header className="official-warning-header">
            <div className="logo-side">
              <img src={header.logoUrl} alt="logo" />
              <div>{header.country}</div>
              <div>{header.ministry}</div>
              <div>{header.directorate}</div>
              <div>{header.committee}</div>
              <div>{header.centerName}</div>
            </div>
            <div className="warning-title-box">إنذار كتابي لممتحن</div>
          </header>

          <section className="document-title">
            <h1>امتحانات دبلوم التعليم العام وما في مستواه</h1>
            <div className="title-lines">
              <FormLine label="للعام الدراسي" value={form.academicYear} onChange={(value) => setField(setForm, "academicYear", value)} />
              <FormLine label="الدور" value={form.round} onChange={(value) => setField(setForm, "round", value)} />
              <FormLine label="الفصل الدراسي" value={form.semester} onChange={(value) => setField(setForm, "semester", value)} />
            </div>
          </section>

          <section className="form-section">
            <SectionTitle>أولاً: البيانات الأساسية:</SectionTitle>
            <div className="two-cols">
              <FormLine label="اسم الممتحن" value={form.candidateName} onChange={(value) => setField(setForm, "candidateName", value)} wide />
              <FormLine label="الرقم المدني" value={form.civilNo} onChange={(value) => setField(setForm, "civilNo", value)} />
              <FormLine label="رقم الجلوس" value={form.seatNo} onChange={(value) => setField(setForm, "seatNo", value)} />
              <FormLine label="المدرسة التابع لها" value={form.schoolName} onChange={(value) => setField(setForm, "schoolName", value)} wide />
              <FormLine label="مركز الامتحان" value={form.centerName} onChange={(value) => setField(setForm, "centerName", value)} wide />
              <FormLine label="المادة" value={form.subject} onChange={(value) => setField(setForm, "subject", value)} wide />
              <FormLine label="اليوم" value={form.day} onChange={(value) => setField(setForm, "day", value)} />
              <FormLine label="التاريخ" value={form.date} onChange={(value) => setField(setForm, "date", value)} />
            </div>
            <div className="time-line">
              <span>تم تحرير إنذار كتابي بالمخالفة:</span>
              <FormLine label="الساعة" value={form.warningHour} onChange={(value) => setField(setForm, "warningHour", value)} />
              <FormLine label="الدقيقة" value={form.warningMinute} onChange={(value) => setField(setForm, "warningMinute", value)} />
            </div>
          </section>

          <section className="form-section violation-section">
            <SectionTitle>ثانياً: نوعية المخالفة تحدد بوضع علامة (✓):</SectionTitle>
            <div className="warning-options">
              {warningOptions.map((option) => {
                const checked = form.violationIds.includes(option.id);
                return (
                  <label key={option.id} className="warning-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setForm((prev) => ({ ...prev, violationIds: toggleInArray(prev.violationIds, option.id) }))}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="other-line">
              <span>أخرى (تحدد):</span>
              <input value={form.otherViolation} onChange={(e) => setField(setForm, "otherViolation", e.target.value)} />
            </div>
          </section>

          <section className="signature-section">
            <div className="signature-box candidate-signature">
              <FormLine label="توقيع الممتحن" value={form.candidateSignature} onChange={(value) => setField(setForm, "candidateSignature", value)} wide />
            </div>

            <div className="signature-grid">
              <div>
                <FormLine label="اسم من قام بضبط المخالفة" value={form.reporterName} onChange={(value) => setField(setForm, "reporterName", value)} wide />
                <FormLine label="رقم الملف" value={form.reporterEmployeeNo} onChange={(value) => setField(setForm, "reporterEmployeeNo", value)} />
                <FormLine label="التوقيع" value={form.reporterSignature} onChange={(value) => setField(setForm, "reporterSignature", value)} />
              </div>
              <div>
                <FormLine label="اسم رئيس المركز" value={form.centerHeadName} onChange={(value) => setField(setForm, "centerHeadName", value)} wide />
                <FormLine label="رقم الملف" value={form.centerHeadEmployeeNo} onChange={(value) => setField(setForm, "centerHeadEmployeeNo", value)} />
                <FormLine label="التوقيع" value={form.centerHeadSignature} onChange={(value) => setField(setForm, "centerHeadSignature", value)} />
              </div>
            </div>

            <div className="stamp-area">ختم<br />مركز<br />الامتحانات</div>
          </section>

          <footer className="warning-note">
            ملاحظة: يحفظ هذا الإنذار لدى رئيس مركز الامتحان وفي حالة تكرار المخالفة أو القيام بمخالفة أخرى يرفق مع محضر المخالفة.
          </footer>
          <div className="page-number">1 / 1</div>
        </section>
      </main>

      <section className="no-print saved-table-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: BLACK }}>سجل الحفظ السحابي</h2>
            <p style={{ margin: "6px 0 0", color: MUTED, fontWeight: 800 }}>يعرض آخر الإنذارات المحفوظة مع إمكانية تعديل السجل أو حذفه. لا يظهر هذا الجدول في الطباعة.</p>
          </div>
          <div style={{ color: GOLD_DARK, fontWeight: 900 }}>المسار: candidateWrittenWarnings12</div>
        </div>
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="saved-table">
            <thead>
              <tr>
                <th>رقم الحفظ</th>
                <th>وقت الحفظ</th>
                <th>اسم الممتحن</th>
                <th>رقم الجلوس</th>
                <th>المادة</th>
                <th>مركز الامتحان</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {savedRows.length ? (
                savedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.savedAtISO}</td>
                    <td>{row.candidateName}</td>
                    <td>{row.seatNo}</td>
                    <td>{row.subject}</td>
                    <td>{row.centerName}</td>
                    <td>{row.status === "complete" ? "مكتمل" : "مسودة"}</td>
                    <td>
                      <div className="saved-actions">
                        <button type="button" onClick={() => editSavedWarning(row)}>تعديل</button>
                        <button type="button" className="danger" onClick={() => deleteSavedWarning(row)} disabled={deletingId === row.id}>
                          {deletingId === row.id ? "جاري الحذف..." : "حذف"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>{loadingSavedRows ? "جاري تحميل السجلات المحفوظة..." : "لم يتم حفظ أي إنذار من هذه الجلسة بعد."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const PRINT_CSS = `
  .print-root,
  .print-root * {
    box-sizing: border-box;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: Tahoma, Arial, sans-serif;
  }

  .print-root {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 12px;
  }

  .a4-page {
    width: min(315mm, calc(100vw - 28px));
    min-height: 318mm;
    margin: 0 auto;
    background: #fff;
    border: 5px solid #8b8b8b;
    padding: 16mm 18mm 13mm;
    position: relative;
    box-shadow: 0 18px 45px rgba(17,24,39,.16);
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }

  .corner {
    position: absolute;
    width: 15mm;
    height: 15mm;
    border-color: #8b8b8b;
    border-style: solid;
  }

  .corner-top-right { top: 3mm; right: 3mm; border-width: 4px 4px 0 0; }
  .corner-top-left { top: 3mm; left: 3mm; border-width: 4px 0 0 4px; }
  .corner-bottom-right { bottom: 3mm; right: 3mm; border-width: 0 4px 4px 0; }
  .corner-bottom-left { bottom: 3mm; left: 3mm; border-width: 0 0 4px 4px; }

  .official-warning-header {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    align-items: start;
    gap: 16mm;
    margin-bottom: 8mm;
  }

  .logo-side {
    text-align: center;
    font-size: 13.5px;
    font-weight: 900;
    line-height: 1.42;
  }

  .logo-side img {
    width: 27mm;
    height: 27mm;
    object-fit: contain;
    display: block;
    margin: 0 auto 2mm;
  }

  .warning-title-box {
    justify-self: start;
    min-width: 92mm;
    border: 2px solid #111827;
    padding: 5mm 8mm;
    text-align: center;
    font-size: 25px;
    font-weight: 1000;
    color: #9b1c1c !important;
    margin-top: 9mm;
  }

  .document-title {
    text-align: center;
    margin-bottom: 7mm;
  }

  .document-title h1 {
    font-size: 26px;
    line-height: 1.35;
    margin: 0 0 3mm;
    font-weight: 1000;
  }

  .title-lines {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 5mm;
    max-width: 235mm;
    margin: 0 auto;
  }

  .form-section {
    margin-top: 4mm;
  }

  .section-title {
    font-size: 16px;
    margin: 0 0 3mm;
    font-weight: 1000;
    text-decoration: underline;
  }

  .two-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 8mm;
    row-gap: 2.4mm;
  }

  .print-line {
    display: flex;
    align-items: center;
    gap: 2mm;
    min-width: 0;
  }

  .print-line.wide {
    grid-column: span 1;
  }

  .print-line-label {
    white-space: nowrap;
    font-weight: 1000;
    font-size: 13px;
  }

  .print-line input,
  .other-line input {
    flex: 1;
    min-width: 0;
    border: 0;
    border-bottom: 1.6px solid ${LINE};
    min-height: 7mm;
    padding: 1mm 2mm;
    font-size: 13px;
    font-weight: 900;
    background: transparent;
    outline: none;
    text-align: center;
  }

  .time-line {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 5mm;
    align-items: center;
    margin-top: 2.5mm;
    font-size: 13px;
    font-weight: 1000;
  }

  .violation-section {
    margin-top: 5mm;
  }

  .warning-options {
    display: grid;
    gap: 2.3mm;
    margin-top: 2mm;
  }

  .warning-option {
    display: flex;
    align-items: flex-start;
    gap: 3mm;
    font-size: 14px;
    font-weight: 900;
    line-height: 1.45;
  }

  .warning-option input {
    width: 4mm;
    height: 4mm;
    margin-top: 1mm;
  }

  .other-line {
    display: flex;
    align-items: center;
    gap: 3mm;
    font-weight: 1000;
    font-size: 14px;
    margin-top: 2mm;
  }

  .signature-section {
    margin-top: 10mm;
    position: relative;
  }

  .candidate-signature {
    width: 70mm;
    margin-right: 14mm;
    margin-bottom: 8mm;
  }

  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16mm;
  }

  .signature-grid > div {
    display: grid;
    gap: 3mm;
  }

  .stamp-area {
    width: 24mm;
    height: 24mm;
    border: 1.5px dashed #111827;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.25;
    font-size: 11px;
    font-weight: 1000;
    margin: 7mm auto 0;
  }

  .warning-note {
    position: absolute;
    left: 11mm;
    right: 11mm;
    bottom: 14mm;
    border: 1.5px solid #111827;
    padding: 2.5mm 4mm;
    text-align: center;
    color: #c1121f !important;
    font-weight: 1000;
    font-size: 13px;
    line-height: 1.45;
  }

  .page-number {
    position: absolute;
    bottom: 5mm;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 12px;
    font-weight: 900;
  }

  .saved-table-card {
    max-width: 1420px;
    margin: 18px auto 0;
    background: rgba(255,250,240,.96);
    border: 1.5px solid ${GOLD_SOFT};
    border-radius: 18px;
    padding: 16px;
    box-shadow: 0 12px 28px rgba(92,64,0,.10);
  }

  .saved-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    color: #111827;
    font-size: 13px;
    font-weight: 800;
  }

  .saved-table th,
  .saved-table td {
    border: 1px solid rgba(181,139,22,.45);
    padding: 9px 10px;
    text-align: center;
    color: #111827;
  }

  .saved-table th {
    background: #f5e6b3;
    font-weight: 1000;
  }

  .saved-actions {
    display: flex;
    gap: 6px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
  }

  .saved-actions button {
    border: 1px solid rgba(181,139,22,.55);
    background: linear-gradient(180deg, #fff8df, #ead28a);
    color: #111827;
    border-radius: 9px;
    padding: 6px 10px;
    font-weight: 900;
    cursor: pointer;
  }

  .saved-actions button.danger {
    border-color: rgba(185,28,28,.45);
    background: linear-gradient(180deg, #fee2e2, #fecaca);
  }

  .saved-actions button:disabled {
    cursor: not-allowed;
    opacity: .7;
  }

  @page {
    size: A4 portrait;
    margin: 0;
  }

  @media print {
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }

    body * {
      visibility: hidden !important;
    }

    .print-root,
    .print-root * {
      visibility: visible !important;
    }

    .print-root {
      position: absolute !important;
      inset: 0 !important;
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: visible !important;
      padding: 0 !important;
    }

    .a4-page {
      width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      margin: 0 auto !important;
      padding: 7mm 8mm 6mm !important;
      border: 2.5px solid #8b8b8b !important;
      box-shadow: none !important;
      page-break-after: auto !important;
      break-after: auto !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      transform: none !important;
    }

    .corner {
      width: 10mm !important;
      height: 10mm !important;
    }

    .corner-top-right { top: 2mm !important; right: 2mm !important; border-width: 2.5px 2.5px 0 0 !important; }
    .corner-top-left { top: 2mm !important; left: 2mm !important; border-width: 2.5px 0 0 2.5px !important; }
    .corner-bottom-right { bottom: 2mm !important; right: 2mm !important; border-width: 0 2.5px 2.5px 0 !important; }
    .corner-bottom-left { bottom: 2mm !important; left: 2mm !important; border-width: 0 0 2.5px 2.5px !important; }

    .official-warning-header {
      grid-template-columns: 1.15fr 1fr !important;
      gap: 6mm !important;
      margin-bottom: 3mm !important;
    }

    .logo-side {
      font-size: 9.4px !important;
      line-height: 1.18 !important;
      font-weight: 900 !important;
    }

    .logo-side img {
      width: 17mm !important;
      height: 17mm !important;
      margin-bottom: 1mm !important;
    }

    .warning-title-box {
      min-width: 58mm !important;
      padding: 2.5mm 5mm !important;
      font-size: 17px !important;
      margin-top: 5mm !important;
      border-width: 1.5px !important;
    }

    .document-title {
      margin-bottom: 3mm !important;
    }

    .document-title h1 {
      font-size: 18px !important;
      line-height: 1.15 !important;
      margin-bottom: 1.5mm !important;
    }

    .title-lines {
      max-width: 176mm !important;
      gap: 2.5mm !important;
    }

    .form-section {
      margin-top: 2mm !important;
    }

    .section-title {
      font-size: 12.5px !important;
      margin-bottom: 1.5mm !important;
    }

    .two-cols {
      column-gap: 4mm !important;
      row-gap: 1.1mm !important;
    }

    .print-line {
      gap: 1mm !important;
    }

    .print-line-label {
      font-size: 10.3px !important;
    }

    .print-line input,
    .other-line input {
      min-height: 4.8mm !important;
      padding: .3mm 1mm !important;
      font-size: 10.3px !important;
      border-bottom-width: 1px !important;
    }

    .time-line {
      gap: 2.5mm !important;
      margin-top: 1.2mm !important;
      font-size: 10.3px !important;
    }

    .violation-section {
      margin-top: 2.5mm !important;
    }

    .warning-options {
      gap: .8mm !important;
      margin-top: 1mm !important;
    }

    .warning-option {
      gap: 1.5mm !important;
      font-size: 10.6px !important;
      line-height: 1.16 !important;
    }

    .warning-option input {
      width: 3mm !important;
      height: 3mm !important;
      margin-top: .3mm !important;
    }

    .other-line {
      gap: 1.5mm !important;
      font-size: 10.6px !important;
      margin-top: 1mm !important;
    }

    .signature-section {
      margin-top: 3.5mm !important;
    }

    .candidate-signature {
      width: 58mm !important;
      margin-right: 8mm !important;
      margin-bottom: 3mm !important;
    }

    .signature-grid {
      gap: 8mm !important;
    }

    .signature-grid > div {
      gap: 1.4mm !important;
    }

    .stamp-area {
      width: 17mm !important;
      height: 17mm !important;
      font-size: 8.5px !important;
      margin-top: 2mm !important;
      border-width: 1px !important;
    }

    .warning-note {
      left: 8mm !important;
      right: 8mm !important;
      bottom: 7mm !important;
      padding: 1.2mm 2mm !important;
      font-size: 9.5px !important;
      line-height: 1.22 !important;
      border-width: 1px !important;
    }

    .page-number {
      bottom: 2mm !important;
      font-size: 9px !important;
    }

    .no-print,
    .no-print * {
      display: none !important;
      visibility: hidden !important;
    }
  }
`;
