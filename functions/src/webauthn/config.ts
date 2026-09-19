export const WEBAUTHN_CONFIG = {
  rpName: "YR Exam Manager",

  // سيتم تثبيت القيمة النهائية عند تجهيز Production Domain.
  rpID: "localhost",

  origin: "http://localhost:5173",

  timeout: 60000,

  userVerification: "preferred" as const,
};
