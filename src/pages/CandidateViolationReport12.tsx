import React, { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n/I18nProvider";
import { tenantPath } from "../config/tenantRoutes";
import { db } from "../firebase/firebase";

type Lang = "ar" | "en";

type StaffStatement = {
  name: string;
  employeeNo: string;
  phone: string;
  school: string;
  wilaya: string;
  statement: string;
  signature: string;
};

type CandidateViolationForm = {
  semester: string;
  round: string;
  academicYear: string;
  candidateName: string;
  civilNo: string;
  seatNo: string;
  candidateCategory: "regular" | "adult" | "";
  address: string;
  phone: string;
  schoolName: string;
  schoolWilaya: string;
  centerName: string;
  centerWilaya: string;
  subject: string;
  day: string;
  date: string;
  violationHour: string;
  violationMinute: string;
  violationIds: string[];
  repeatedViolationDetails: string;
  impersonatorName: string;
  impersonatorCivilNo: string;
  impersonatorRelation: string;
  impersonatorJob: string;
  impersonatorPhone: string;
  impersonatorEmployer: string;
  discoveryHour: string;
  discoveryMinute: string;
  firstInvigilator: StaffStatement;
  secondInvigilator: StaffStatement;
  dutyInvigilator: StaffStatement;
  centerHead: StaffStatement;
  candidateSignature: string;
  directorateOpinion: string;
  directorateSignature: string;
  ministrySupervisorOpinion: string;
  ministrySupervisorSignature: string;
  committeeOpinion: string;
  committeeSignatures: string;
  committeeChairName: string;
  attachments: string[];
  mobileType: string;
  otherAttachments: string;
};

type OfficialHeader = {
  country: string;
  ministry: string;
  directorate: string;
  committee: string;
  centerName: string;
  academicYear: string;
  logoUrl: string;
};

type SavedReportRow = {
  id: string;
  savedAtISO: string;
  candidateName: string;
  seatNo: string;
  subject: string;
  centerName: string;
  status: "complete" | "draft";
};


const DEFAULT_LOGO_URL = "https://i.imgur.com/vdDhSMh.png";
const EXAM_CENTER_DATA_KEY = "exam-manager:exam-center-data:v1";
const EXAM_CENTER_LOGO_KEY = "exam-manager:exam-center-logo:v1";
const APP_LOGO_KEY = "exam-manager:app-logo";

const GOLD = "#b58b16";
const GOLD_SOFT = "#d7bd63";
const BLACK = "#111827";
const MUTED = "#4b5563";
const PAGE_BG =
  "radial-gradient(900px 420px at 50% -10%, rgba(212,175,55,.20), transparent 60%), linear-gradient(180deg, #fffdf7 0%, #f6efe0 48%, #fffaf0 100%)";

const emptyStaff = (): StaffStatement => ({
  name: "",
  employeeNo: "",
  phone: "",
  school: "",
  wilaya: "",
  statement: "",
  signature: "",
});

const defaultForm = (): CandidateViolationForm => ({
  semester: "",
  round: "",
  academicYear: "",
  candidateName: "",
  civilNo: "",
  seatNo: "",
  candidateCategory: "",
  address: "",
  phone: "",
  schoolName: "",
  schoolWilaya: "",
  centerName: "",
  centerWilaya: "",
  subject: "",
  day: "",
  date: "",
  violationHour: "",
  violationMinute: "",
  violationIds: [],
  repeatedViolationDetails: "",
  impersonatorName: "",
  impersonatorCivilNo: "",
  impersonatorRelation: "",
  impersonatorJob: "",
  impersonatorPhone: "",
  impersonatorEmployer: "",
  discoveryHour: "",
  discoveryMinute: "",
  firstInvigilator: emptyStaff(),
  secondInvigilator: emptyStaff(),
  dutyInvigilator: emptyStaff(),
  centerHead: emptyStaff(),
  candidateSignature: "",
  directorateOpinion: "",
  directorateSignature: "",
  ministrySupervisorOpinion: "",
  ministrySupervisorSignature: "",
  committeeOpinion: "",
  committeeSignatures: "",
  committeeChairName: "",
  attachments: [],
  mobileType: "",
  otherAttachments: "",
});

const violationOptions = [
  { id: "1", text: "تكرار المخالفة المحددة أدناه بعد الإنذار الكتابي" },
  { id: "1a", text: "عدم الالتزام بالزي" },
  { id: "1b", text: "التأخر عن دخول قاعة الامتحان لمدة تزيد عن عشر دقائق عن بدء الامتحان" },
  { id: "1c", text: "عدم إحضار أصل إثبات الهوية" },
  { id: "1d", text: "الإصرار على عدم التقيد بالمكان المخصص داخل قاعة الامتحان" },
  { id: "1e", text: "العبث بالترقيم الآلي في دفتر الامتحان" },
  { id: "2", text: "اصطحاب هاتف أو جهاز أو كتب أو دفاتر أو مذكرات أو أي شيء له علاقة بالامتحان" },
  { id: "3", text: "رفض الممتحن لإجراءات التفتيش" },
  { id: "4", text: "الغش في الامتحان أو الإسهام أو الشروع فيه أو المعاونة عليه" },
  { id: "5", text: "التخاطب مع المراقب دون مبرر داخل القاعة" },
  { id: "6", text: "التخاطب مع ممتحن آخر داخل القاعة" },
  { id: "7", text: "الإخلال أو الاستهتار بالأنظمة والضوابط داخل مركز الامتحان" },
  { id: "8", text: "رفض تسليم دفتر الامتحان" },
  { id: "9", text: "تمزيق دفتر الامتحان أو إخفاؤه أو رميه أو الهروب به" },
  { id: "10", text: "الاعتداء بالقول على أحد الممتحنين أو العاملين بالامتحانات" },
  { id: "11", text: "الاعتداء بالفعل على أحد الممتحنين أو العاملين بالامتحانات" },
  { id: "12", text: "انتحال الشخصية" },
  { id: "13", text: "الكتابة أو الرسومات المسيئة أو ما يعد قذفًا أو سبًا في دفتر الامتحان" },
  { id: "14", text: "اصطحاب الآلات الحادة أو الأسلحة أيًا كان نوعها داخل مركز الامتحان" },
];

const attachmentOptions = [
  { id: "examBook", label: "دفتر الامتحان" },
  { id: "violationTool", label: "أداة المخالفة" },
  { id: "mobilePhone", label: "هاتف نقال" },
  { id: "backgrounds", label: "خلفيات أخرى" },
  { id: "writtenWarning", label: "إنذار كتابي لممتحن" },
];

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

function buildHeader(lang: Lang): OfficialHeader {
  const payload = safeReadJson<Record<string, any>>(EXAM_CENTER_DATA_KEY) || {};
  const logo = firstText(
    typeof window !== "undefined" ? window.localStorage.getItem(EXAM_CENTER_LOGO_KEY) : "",
    typeof window !== "undefined" ? window.localStorage.getItem(APP_LOGO_KEY) : "",
    payload.logoUrl,
    DEFAULT_LOGO_URL,
  );

  const governorate = firstText(payload.governorate, payload.regionAr, payload.region, payload.directorateName, payload.directorate);
  const directorate = firstText(
    payload.directorateName,
    payload.educationDirectorate,
    payload.generalDirectorate,
    governorate ? `المديرية العامة للتعليم بمحافظة ${governorate}` : "المديرية العامة للتعليم",
  );

  return {
    country: firstText(payload.country, payload.countryName, lang === "ar" ? "سلطنة عمان" : "Sultanate of Oman"),
    ministry: firstText(payload.ministry, payload.ministryName, lang === "ar" ? "وزارة  التعليم" : "Ministry of Education"),
    directorate,
    committee: firstText(payload.examCommitteeName, payload.committee, governorate ? `لجنة إدارة الامتحانات بمحافظة ${governorate}` : "لجنة إدارة الامتحانات"),
    centerName: firstText(payload.name, payload.centerName, payload.examCenterName, payload.controlCenterName, payload.schoolName, "مركز امتحان دبلوم التعليم العام"),
    academicYear: firstText(payload.academicYear, payload.yearLabel, payload.studyYear, getAcademicYear()),
    logoUrl: logo,
  };
}

function textInputBase(multiline = false): React.CSSProperties {
  return {
    width: "100%",
    minHeight: multiline ? 92 : 42,
    border: "1.5px solid #bfa650",
    borderRadius: 10,
    background: "#ffffff",
    color: BLACK,
    fontWeight: 800,
    fontSize: 14,
    padding: "9px 11px",
    boxSizing: "border-box",
    outline: "none",
    resize: multiline ? "vertical" : undefined,
  };
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label style={{ display: "grid", gap: 7, color: BLACK, fontWeight: 900, fontSize: 13 }}>
      <span>{label}</span>
      <input value={value} type={type} placeholder={placeholder || label} onChange={(event) => onChange(event.target.value)} style={textInputBase(false)} />
    </label>
  );
}

function TextArea({ label, value, onChange, minHeight = 96 }: { label: string; value: string; onChange: (value: string) => void; minHeight?: number }) {
  return (
    <label style={{ display: "grid", gap: 7, color: BLACK, fontWeight: 900, fontSize: 13 }}>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} style={{ ...textInputBase(true), minHeight }} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="official-section" style={{ border: "2px solid #d1b55a", borderRadius: 16, background: "#fffdf6", padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: BLACK, fontWeight: 1000, fontSize: 19 }}>
        <span style={{ width: 8, height: 28, borderRadius: 99, background: GOLD }} />
        {title}
      </div>
      {children}
    </section>
  );
}

function Grid({ children, min = 220 }: { children: React.ReactNode; min?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>{children}</div>;
}

function StaffBlock({ title, data, onChange }: { title: string; data: StaffStatement; onChange: (value: StaffStatement) => void }) {
  const set = (key: keyof StaffStatement, value: string) => onChange({ ...data, [key]: value });
  return (
    <div style={{ border: "1.5px solid #d8c378", borderRadius: 14, padding: 14, background: "#fffaf0", display: "grid", gap: 12 }}>
      <div style={{ color: GOLD, fontWeight: 1000, fontSize: 16 }}>{title}</div>
      <Grid min={190}>
        <Field label="الاسم" value={data.name} onChange={(value) => set("name", value)} />
        <Field label="رقم الملف" value={data.employeeNo} onChange={(value) => set("employeeNo", value)} />
        <Field label="رقم الهاتف" value={data.phone} onChange={(value) => set("phone", value)} />
        <Field label="المدرسة التابع لها" value={data.school} onChange={(value) => set("school", value)} />
        <Field label="الولاية" value={data.wilaya} onChange={(value) => set("wilaya", value)} />
      </Grid>
      <TextArea label={title.includes("رئيس") ? "الإفادة والرأي" : "الإفادة"} value={data.statement} onChange={(value) => set("statement", value)} minHeight={115} />
      <Field label="التوقيع" value={data.signature} onChange={(value) => set("signature", value)} />
    </div>
  );
}

function PrintableHeader({ data }: { data: OfficialHeader }) {
  return (
    <div className="print-header" style={{ border: "2.5px solid #8f8f8f", borderRadius: 4, padding: 18, background: "#fff", position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 1fr", alignItems: "center", gap: 16 }}>
        <div style={{ textAlign: "right", color: BLACK, fontWeight: 1000, lineHeight: 1.8 }}>
          <div>{data.country}</div>
          <div>{data.ministry}</div>
          <div>{data.committee}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          {data.logoUrl ? <img src={data.logoUrl} alt="logo" style={{ width: 92, height: 92, objectFit: "contain" }} /> : null}
        </div>
        <div style={{ textAlign: "left", color: BLACK, fontWeight: 900, lineHeight: 1.8 }}>
          <div>{data.directorate}</div>
          <div>{data.centerName}</div>
          <div>العام الدراسي {data.academicYear}</div>
        </div>
      </div>
      <div style={{ margin: "16px auto 0", maxWidth: 390, border: "2px solid #111", padding: "8px 18px", color: "#8b1e1e", fontWeight: 1000, fontSize: 24, textAlign: "center" }}>
        محضر مخالفة ممتحن
      </div>
    </div>
  );
}

function SmallLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", minHeight: 30 }}>
      <span style={{ fontWeight: 1000, color: BLACK, whiteSpace: "nowrap" }}>{label}:</span>
      <span style={{ flex: 1, borderBottom: "1.5px solid #111", minHeight: 24, color: BLACK, fontWeight: 800 }}>{value || ""}</span>
    </div>
  );
}


function getMissingRequiredFields(form: CandidateViolationForm) {
  const missing: string[] = [];
  if (!String(form.candidateName || "").trim()) missing.push("اسم الممتحن");
  if (!String(form.seatNo || "").trim()) missing.push("رقم الجلوس");
  if (!String(form.subject || "").trim()) missing.push("المادة");
  return missing;
}

function formatSavedAt(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-OM", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CandidateViolationReportForm12() {
  const navigate = useNavigate();
  const authContext = useAuth() as any;
  const { tenantId: routeTenantId } = useParams();
  const { lang, isRTL } = useI18n();
  const effectiveTenantId = String(routeTenantId || authContext?.effectiveTenantId || "").trim();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [form, setForm] = useState<CandidateViolationForm>(() => defaultForm());
  const [savingReport, setSavingReport] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savedReports, setSavedReports] = useState<SavedReportRow[]>([]);

  const header = useMemo(() => buildHeader(lang === "ar" ? "ar" : "en"), [lang]);
  const selectedViolations = useMemo(() => new Set(form.violationIds), [form.violationIds]);
  const selectedAttachments = useMemo(() => new Set(form.attachments), [form.attachments]);

  const set = (key: keyof CandidateViolationForm, value: any) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleViolation = (id: string) => {
    setForm((prev) => {
      const current = new Set(prev.violationIds);
      current.has(id) ? current.delete(id) : current.add(id);
      return { ...prev, violationIds: Array.from(current) };
    });
  };
  const toggleAttachment = (id: string) => {
    setForm((prev) => {
      const current = new Set(prev.attachments);
      current.has(id) ? current.delete(id) : current.add(id);
      return { ...prev, attachments: Array.from(current) };
    });
  };

  const fillToday = () => {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const day = new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(now);
    setForm((prev) => ({
      ...prev,
      date: iso,
      day,
      academicYear: prev.academicYear || header.academicYear,
      centerName: prev.centerName || header.centerName,
    }));
  };

  const handleSaveReportToCloud = async () => {
    if (!effectiveTenantId) {
      setSaveMessage("تعذر الحفظ: لا يوجد نطاق مركز في الرابط.");
      return;
    }

    const missing = getMissingRequiredFields(form);
    const status: SavedReportRow["status"] = missing.length ? "draft" : "complete";
    const now = new Date();

    if (missing.length) {
      const ok = window.confirm(
        `البيانات الأساسية التالية غير مكتملة: ${missing.join("، ")}. هل تريد حفظ التقرير كمسودة؟`,
      );
      if (!ok) return;
    }

    setSavingReport(true);
    setSaveMessage("");

    try {
      const selectedViolationTexts = violationOptions
        .filter((item) => form.violationIds.includes(item.id))
        .map((item) => item.text);

      const selectedAttachmentLabels = attachmentOptions
        .filter((item) => form.attachments.includes(item.id))
        .map((item) => item.label);

      const createdBy = {
        uid: firstText(authContext?.user?.uid, authContext?.uid),
        email: firstText(authContext?.user?.email, authContext?.profile?.email, authContext?.email),
        name: firstText(authContext?.profile?.displayName, authContext?.user?.displayName, authContext?.displayName),
      };

      const payload = {
        type: "candidateViolationReport12",
        tenantId: effectiveTenantId,
        status,
        form,
        officialHeader: header,
        selectedViolationTexts,
        selectedAttachmentLabels,
        missingRequiredFields: missing,
        printFormat: "A4 portrait",
        createdAt: serverTimestamp(),
        createdAtISO: now.toISOString(),
        createdBy,
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "tenants", effectiveTenantId, "candidateViolationReports12"),
        payload,
      );

      const savedRow: SavedReportRow = {
        id: docRef.id,
        savedAtISO: now.toISOString(),
        candidateName: form.candidateName || "غير محدد",
        seatNo: form.seatNo || "غير محدد",
        subject: form.subject || "غير محدد",
        centerName: form.centerName || header.centerName || "غير محدد",
        status,
      };

      setSavedReports((prev) => [savedRow, ...prev]);
      setSaveMessage(`تم حفظ التقرير في السحابة بنجاح. رقم الحفظ: ${docRef.id}`);
    } catch (error: any) {
      const message = error?.code
        ? `${error.code}: ${error.message || "حدث خطأ أثناء الحفظ"}`
        : error?.message || "حدث خطأ أثناء الحفظ في السحابة.";
      setSaveMessage(`فشل حفظ التقرير في السحابة: ${message}`);
    } finally {
      setSavingReport(false);
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      style={{ minHeight: "100vh", background: PAGE_BG, color: BLACK, padding: 24, boxSizing: "border-box" }}
    >
      <style>{`
        .candidate-violation-page, .candidate-violation-page * { color: #111827 !important; -webkit-text-fill-color: #111827 !important; box-sizing: border-box; }
        .candidate-violation-page input, .candidate-violation-page textarea, .candidate-violation-page select { color: #111827 !important; -webkit-text-fill-color: #111827 !important; }
        .candidate-violation-page button { cursor: pointer; }
        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .candidate-violation-page { padding: 0 !important; background: #ffffff !important; }
          .screen-card { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: none !important; }
          .print-sheet { page-break-after: always; min-height: 277mm; border: 1.5px solid #7d7d7d !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; padding: 11mm !important; }
          .print-sheet:last-child { page-break-after: auto; }
          input, textarea { border-color: #111 !important; background: #fff !important; }
        }
      `}</style>

      <main className="candidate-violation-page" style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ color: GOLD, fontWeight: 1000, fontSize: 15 }}>{tr("صفحة رسمية خاصة", "Official special page")}</div>
            <h1 style={{ margin: "4px 0 0", fontSize: 32, color: BLACK }}>محضر مخالفة ممتحن</h1>
            <p style={{ margin: "6px 0 0", color: MUTED, fontWeight: 800 }}>نموذج مطابق لبنية المحضر الرسمي مع ترويسة مركز الامتحانات والطباعة بصيغة A4.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => navigate(tenantPath(effectiveTenantId, "/control12"))} style={buttonStyle("#fff8df")}>{tr("العودة للكنترول", "Back to Control")}</button>
            <button onClick={fillToday} style={buttonStyle("#e0f2fe")}>{tr("تعبئة التاريخ والمركز", "Fill date and center")}</button>
            <button onClick={handleSaveReportToCloud} disabled={savingReport} style={buttonStyle("#dbeafe")}>
              {savingReport ? tr("جاري الحفظ...", "Saving...") : tr("حفظ التقرير في السحابة", "Save report to cloud")}
            </button>
            <button onClick={() => window.print()} style={buttonStyle("#dcfce7")}>{tr("طباعة / PDF", "Print / PDF")}</button>
            <button onClick={() => setForm(defaultForm())} style={buttonStyle("#fee2e2")}>{tr("تفريغ النموذج", "Clear form")}</button>
          </div>
        </div>

        {saveMessage ? (
          <div
            className="no-print"
            style={{
              marginBottom: 14,
              border: `1.5px solid ${saveMessage.includes("فشل") || saveMessage.includes("تعذر") ? "#dc2626" : "#16a34a"}`,
              background: saveMessage.includes("فشل") || saveMessage.includes("تعذر") ? "#fef2f2" : "#f0fdf4",
              borderRadius: 14,
              padding: "12px 14px",
              color: BLACK,
              fontWeight: 900,
            }}
          >
            {saveMessage}
          </div>
        ) : null}

        <div className="screen-card" style={{ background: "#fffdf6", border: "2px solid #d0b45a", borderRadius: 22, boxShadow: "0 18px 38px rgba(92,64,0,.13)", padding: 18, display: "grid", gap: 18 }}>
          <div className="print-sheet" style={{ background: "#fff", border: "2px solid #d0b45a", borderRadius: 16, padding: 18, display: "grid", gap: 16 }}>
            <PrintableHeader data={header} />

            <Section title="التمهيد والبيانات الأساسية">
              <div style={{ display: "grid", gap: 10, lineHeight: 1.9, fontWeight: 900 }}>
                <div>الفاضلة / المشرفة العامة لامتحانات دبلوم التعليم العام وما في مستواه المحترمة</div>
                <div>السلام عليكم ورحمة الله وبركاته ... وبعد،،،</div>
                <div>الموضوع: <strong>محضر مخالفة ممتحن</strong></div>
                <div>نود إفادتكم بأنه تم ضبط مخالفة ممتحن أثناء تأدية امتحان دبلوم التعليم العام وما في مستواه، وذلك على النحو التالي:</div>
              </div>
              <Grid min={190}>
                <Field label="الفصل الدراسي" value={form.semester} onChange={(value) => set("semester", value)} />
                <Field label="الدور" value={form.round} onChange={(value) => set("round", value)} />
                <Field label="العام الدراسي" value={form.academicYear} onChange={(value) => set("academicYear", value)} placeholder={header.academicYear} />
              </Grid>
              <Grid min={220}>
                <Field label="اسم الممتحن" value={form.candidateName} onChange={(value) => set("candidateName", value)} />
                <Field label="الرقم المدني" value={form.civilNo} onChange={(value) => set("civilNo", value)} />
                <Field label="رقم الجلوس" value={form.seatNo} onChange={(value) => set("seatNo", value)} />
              </Grid>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontWeight: 900 }}>
                <label><input type="radio" checked={form.candidateCategory === "regular"} onChange={() => set("candidateCategory", "regular")} /> طالب نظامي</label>
                <label><input type="radio" checked={form.candidateCategory === "adult"} onChange={() => set("candidateCategory", "adult")} /> دارس تعليم كبار</label>
              </div>
              <Grid min={220}>
                <Field label="العنوان الدائم" value={form.address} onChange={(value) => set("address", value)} />
                <Field label="رقم الهاتف" value={form.phone} onChange={(value) => set("phone", value)} />
                <Field label="المدرسة التابع لها" value={form.schoolName} onChange={(value) => set("schoolName", value)} />
                <Field label="ولاية المدرسة" value={form.schoolWilaya} onChange={(value) => set("schoolWilaya", value)} />
                <Field label="مركز الامتحان" value={form.centerName} onChange={(value) => set("centerName", value)} placeholder={header.centerName} />
                <Field label="ولاية المركز" value={form.centerWilaya} onChange={(value) => set("centerWilaya", value)} />
                <Field label="المادة" value={form.subject} onChange={(value) => set("subject", value)} />
                <Field label="اليوم" value={form.day} onChange={(value) => set("day", value)} />
                <Field label="التاريخ" value={form.date} onChange={(value) => set("date", value)} type="date" />
                <Field label="ساعة ضبط المخالفة" value={form.violationHour} onChange={(value) => set("violationHour", value)} />
                <Field label="الدقيقة" value={form.violationMinute} onChange={(value) => set("violationMinute", value)} />
              </Grid>
            </Section>

            <Section title="نوعية المخالفة">
              <div style={{ color: "#b91c1c", fontWeight: 1000 }}>تحدد المخالفة بوضع علامة على نوع المخالفة، مع تعبئة البيانات والتأكد من صحتها.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 10 }}>
                {violationOptions.map((item) => (
                  <label key={item.id} style={{ border: "1.4px solid #d7bd63", borderRadius: 12, padding: 10, background: selectedViolations.has(item.id) ? "#fef3c7" : "#fffaf0", display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 850, lineHeight: 1.6 }}>
                    <input type="checkbox" checked={selectedViolations.has(item.id)} onChange={() => toggleViolation(item.id)} />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>
              <TextArea label="تفاصيل المخالفة المتكررة أو ملاحظات إضافية" value={form.repeatedViolationDetails} onChange={(value) => set("repeatedViolationDetails", value)} />
            </Section>
          </div>

          <div className="print-sheet" style={{ background: "#fff", border: "2px solid #d0b45a", borderRadius: 16, padding: 18, display: "grid", gap: 16 }}>
            <PrintableHeader data={header} />
            <Section title="بيانات الشخص الذي قام بانتحال الشخصية - في حال انتحال الشخصية فقط">
              <Grid min={210}>
                <Field label="الاسم" value={form.impersonatorName} onChange={(value) => set("impersonatorName", value)} />
                <Field label="الرقم المدني" value={form.impersonatorCivilNo} onChange={(value) => set("impersonatorCivilNo", value)} />
                <Field label="صلة القرابة" value={form.impersonatorRelation} onChange={(value) => set("impersonatorRelation", value)} />
                <Field label="الوظيفة" value={form.impersonatorJob} onChange={(value) => set("impersonatorJob", value)} />
                <Field label="رقم الهاتف" value={form.impersonatorPhone} onChange={(value) => set("impersonatorPhone", value)} />
                <Field label="جهة العمل" value={form.impersonatorEmployer} onChange={(value) => set("impersonatorEmployer", value)} />
                <Field label="وقت اكتشاف الحالة - الساعة" value={form.discoveryHour} onChange={(value) => set("discoveryHour", value)} />
                <Field label="الدقيقة" value={form.discoveryMinute} onChange={(value) => set("discoveryMinute", value)} />
              </Grid>
            </Section>

            <Section title="إفادة المراقبين ومراقب الدور ورئيس المركز">
              <StaffBlock title="اسم المراقب الأول" data={form.firstInvigilator} onChange={(value) => set("firstInvigilator", value)} />
              <StaffBlock title="اسم المراقب الثاني" data={form.secondInvigilator} onChange={(value) => set("secondInvigilator", value)} />
              <StaffBlock title="اسم مراقب الدور" data={form.dutyInvigilator} onChange={(value) => set("dutyInvigilator", value)} />
              <StaffBlock title="اسم رئيس المركز" data={form.centerHead} onChange={(value) => set("centerHead", value)} />
              <Field label="توقيع الممتحن" value={form.candidateSignature} onChange={(value) => set("candidateSignature", value)} />
            </Section>
          </div>

          <div className="print-sheet" style={{ background: "#fff", border: "2px solid #d0b45a", borderRadius: 16, padding: 18, display: "grid", gap: 16 }}>
            <PrintableHeader data={header} />
            <Section title="رأي مدير عام المديرية العامة التعليم - رئيس لجنة إدارة الامتحانات بالمحافظة">
              <TextArea label="الرأي" value={form.directorateOpinion} onChange={(value) => set("directorateOpinion", value)} minHeight={150} />
              <Field label="التوقيع" value={form.directorateSignature} onChange={(value) => set("directorateSignature", value)} />
            </Section>
            <Section title="رأي المشرفة العامة للامتحانات بالوزارة وتحديد الإجراء والعقوبة المتخذة">
              <TextArea label="الرأي والإجراء" value={form.ministrySupervisorOpinion} onChange={(value) => set("ministrySupervisorOpinion", value)} minHeight={150} />
              <Field label="التوقيع" value={form.ministrySupervisorSignature} onChange={(value) => set("ministrySupervisorSignature", value)} />
            </Section>
            <Section title="رأي لجنة دراسة مخالفات ضوابط الامتحانات ودراسة الحالات الخاصة">
              <TextArea label="رأي اللجنة" value={form.committeeOpinion} onChange={(value) => set("committeeOpinion", value)} minHeight={140} />
              <TextArea label="توقيع أعضاء اللجنة" value={form.committeeSignatures} onChange={(value) => set("committeeSignatures", value)} minHeight={100} />
              <Field label="يعتمد - رئيس لجنة دراسة مخالفات ضوابط الامتحانات ودراسة الحالات الخاصة" value={form.committeeChairName} onChange={(value) => set("committeeChairName", value)} />
            </Section>
            <Section title="المرفقات">
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontWeight: 900 }}>
                {attachmentOptions.map((item) => (
                  <label key={item.id} style={{ display: "inline-flex", gap: 8, alignItems: "center", border: "1.4px solid #d7bd63", borderRadius: 999, padding: "9px 12px", background: selectedAttachments.has(item.id) ? "#fef3c7" : "#fffaf0" }}>
                    <input type="checkbox" checked={selectedAttachments.has(item.id)} onChange={() => toggleAttachment(item.id)} />
                    {item.label}
                  </label>
                ))}
              </div>
              <Grid min={230}>
                <Field label="هاتف نقال من نوع" value={form.mobileType} onChange={(value) => set("mobileType", value)} />
                <Field label="خلفيات أخرى" value={form.otherAttachments} onChange={(value) => set("otherAttachments", value)} />
              </Grid>
            </Section>
          </div>
        </div>

        <section
          className="no-print saved-reports-table"
          style={{
            marginTop: 18,
            background: "#fffdf6",
            border: "2px solid #d0b45a",
            borderRadius: 20,
            boxShadow: "0 14px 30px rgba(92,64,0,.12)",
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, color: BLACK, fontSize: 22, fontWeight: 1000 }}>
                جدول التقارير المحفوظة في السحابة
              </h2>
              <p style={{ margin: "6px 0 0", color: MUTED, fontWeight: 800 }}>
                هذا الجدول يظهر على الشاشة فقط ولا يظهر في الطباعة أو PDF.
              </p>
            </div>
            <div style={{ color: GOLD, fontWeight: 1000 }}>
              عدد السجلات الحالية: {savedReports.length}
            </div>
          </div>

          {savedReports.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 760, color: BLACK }}>
                <thead>
                  <tr>
                    {["رقم الحفظ", "وقت الحفظ", "اسم الممتحن", "رقم الجلوس", "المادة", "مركز الامتحان", "الحالة"].map((head) => (
                      <th
                        key={head}
                        style={{
                          border: "1px solid #bfa650",
                          background: "#f3e3ad",
                          padding: "10px 12px",
                          textAlign: "center",
                          color: BLACK,
                          fontWeight: 1000,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedReports.map((row) => (
                    <tr key={row.id}>
                      <td style={tableCellStyle}>{row.id}</td>
                      <td style={tableCellStyle}>{formatSavedAt(row.savedAtISO)}</td>
                      <td style={tableCellStyle}>{row.candidateName}</td>
                      <td style={tableCellStyle}>{row.seatNo}</td>
                      <td style={tableCellStyle}>{row.subject}</td>
                      <td style={tableCellStyle}>{row.centerName}</td>
                      <td style={tableCellStyle}>{row.status === "complete" ? "مكتمل" : "مسودة"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ border: "1.5px dashed #c7ad56", borderRadius: 14, padding: 16, background: "#fffaf0", color: MUTED, fontWeight: 900 }}>
              لا توجد تقارير محفوظة في هذه الجلسة حتى الآن. بعد الضغط على زر حفظ التقرير في السحابة سيظهر السجل هنا.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const tableCellStyle: React.CSSProperties = {
  border: "1px solid #d1b55a",
  background: "#ffffff",
  padding: "9px 10px",
  textAlign: "center",
  color: BLACK,
  WebkitTextFillColor: BLACK,
  fontWeight: 850,
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function buttonStyle(background: string): React.CSSProperties {
  return {
    border: `1.5px solid ${GOLD_SOFT}`,
    background,
    color: BLACK,
    WebkitTextFillColor: BLACK,
    borderRadius: 14,
    padding: "10px 16px",
    fontWeight: 1000,
    fontSize: 14,
    boxShadow: "0 8px 18px rgba(92,64,0,.12)",
  };
}
