// src/constants/directorates.ts
export const PRIMARY_SUPER_ADMIN_EMAIL = "3asal2030@gmail.com";

export const DIRECTORATES = [
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
  "المديرية العامة للتعليم بمحافظة مسندم"
] as const;

// Special scope for "Super Ministry"
export const MINISTRY_SCOPE = "الوزارة";

export function normalizeText(s: string) {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\u200f|\u200e/g, "");
}

export function isSameDirectorate(a: string, b: string) {
  return normalizeText(a) === normalizeText(b);
}
