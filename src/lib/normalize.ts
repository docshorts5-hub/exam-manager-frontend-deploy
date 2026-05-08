// src/lib/normalize.ts
/**
 * توحيد النصوص لتفادي أخطاء المطابقة:
 * - إزالة المسافات الزائدة
 * - توحيد أشكال الأرقام العربية/الإنجليزية
 * - إزالة الفواصل/الشرطات غير المهمة
 */
export function normalizeText(input?: string): string {
  const s = (input ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\u200f\u200e]/g, ""); // RTL marks

  // تحويل الأرقام العربية إلى إنجليزية
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  let out = "";
  for (const ch of s) {
    const i = arabicDigits.indexOf(ch);
    out += i >= 0 ? String(i) : ch;
  }

  // توحيد بعض العلامات
  out = out
    .replace(/[ـ]+/g, "") // كشيدة
    .replace(/[،]/g, ",")
    .replace(/[–—]/g, "-");

  return out;
}

export function normalizeSubject(input?: string): string {
  // للمواد نزيل التشكيل البسيط وبعض الرموز
  return normalizeText(input)
    .replace(/[\u064B-\u0652]/g, "") // تشكيل عربي
    .replace(/[()]/g, "")
    .trim();
}

export function sameSubject(a?: string, b?: string): boolean {
  return normalizeSubject(a) === normalizeSubject(b);
}
