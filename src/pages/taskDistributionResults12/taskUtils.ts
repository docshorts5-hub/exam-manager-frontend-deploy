export function normalizeStoredTaskType(taskType: any) {
  const raw = String(taskType || "").trim().toUpperCase();

  if (raw === "INVIGILATION") return "INVIGILATION";
  if (raw === "RESERVE") return "RESERVE";
  if (raw === "DUTY_INVIGILATOR") return "DUTY_INVIGILATOR";

  // توافق مع البيانات القديمة: أي مراجعة/تصحيح قديم يعرض ويعامل كمراقب دور
  if (raw === "REVIEW_FREE" || raw === "CORRECTION_FREE") return "DUTY_INVIGILATOR";

  const arabic = String(taskType || "").trim();
  if (arabic.includes("مراقب دور")) return "DUTY_INVIGILATOR";
  if (arabic.includes("مراقبة")) return "INVIGILATION";
  if (arabic.includes("احتياط")) return "RESERVE";
  if (arabic.includes("مراجعة") || arabic.includes("تصحيح")) return "DUTY_INVIGILATOR";

  return raw || "DUTY_INVIGILATOR";
}

export function taskTypeLabel(taskType: any) {
  switch (normalizeStoredTaskType(taskType)) {
    case "INVIGILATION":
      return "مراقبة";
    case "RESERVE":
      return "احتياط";
    case "DUTY_INVIGILATOR":
      return "مراقب دور";
    default:
      return "مهمة";
  }
}

// بعض الملفات القديمة تستورد الاسم taskLabel بدل taskTypeLabel
export const taskLabel = taskTypeLabel;

export function normalizeSubject(subject: string) {
  return String(subject || "").replace(/\s+/g, " ").trim();
}

export function getCommitteeNo(a: any) {
  const value = a?.committeeNo ?? a?.committee ?? a?.roomNo ?? a?.room;
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

export function periodToAMPM(period?: string): "AM" | "PM" {
  const p = String(period || "AM").trim().toUpperCase();
  if (p === "PM" || p === "BM" || String(period || "").includes("الثانية")) return "PM";
  return "AM";
}

export function formatPeriod(period?: string) {
  return periodToAMPM(period) === "PM" ? "الفترة الثانية" : "الفترة الأولى";
}

export function formatDateWithDayAr(dateISO: string) {
  const value = String(dateISO || "").trim();
  if (!value) return { day: "—", full: "—", line: "—" };

  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: value, full: value, line: value };

  const day = new Intl.DateTimeFormat("ar", { weekday: "long" }).format(d);
  const full = new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  return { day, full, line: `${day} ${full}` };
}

// مطلوب بواسطة excelHelpers.ts. تم إلغاء ترحيل الجمعة/السبت، لذلك تُرجع التاريخ كما هو.
export function shiftWeekendToSunday(dateISO: string) {
  return String(dateISO || "").trim();
}
