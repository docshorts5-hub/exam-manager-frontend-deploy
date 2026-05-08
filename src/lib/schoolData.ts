// src/lib/schoolData.ts
export type SchoolData = {
  name: string;
  governorate: string; // المديرية
  semester: string;    // الفصل الدراسي
  phone?: string;
  address?: string;
};

const SCHOOL_DATA_KEY = "exam-manager:school-data:v1";

export function getAcademicYearFromSystemDate(now = new Date()) {
  // افتراض: العام الدراسي يبدأ في سبتمبر
  const month = now.getMonth() + 1; // 1..12
  const year = now.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
}

export function getSchoolData(): SchoolData | null {
  try {
    const raw = localStorage.getItem(SCHOOL_DATA_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SchoolData;
    if (!v || typeof v !== "object") return null;
    return {
      name: String((v as any).name ?? "").trim(),
      governorate: String((v as any).governorate ?? "").trim(),
      semester: String((v as any).semester ?? "").trim(),
      phone: String((v as any).phone ?? "").trim(),
      address: String((v as any).address ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export function buildOfficialHeaderLines() {
  const sd = getSchoolData();
  const academicYear = getAcademicYearFromSystemDate(new Date());
  const lines: string[] = [];

  // رأس رسمي ثابت
  lines.push("سلطنة عُمان");
  lines.push("وزارة التربية والتعليم");

  // من بيانات المدرسة
  if (sd?.governorate) lines.push(sd.governorate);
  if (sd?.name) lines.push(sd.name);

  lines.push(`العام الدراسي: ${academicYear}`);
  if (sd?.semester) lines.push(sd.semester);

  return { lines, schoolData: sd, academicYear };
}
