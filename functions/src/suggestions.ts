import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import nodemailer from "nodemailer";

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

type SuggestionPayload = {
  title: string;
  schoolName: string;
  schoolEmail: string;
  notes: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export const sendSuggestionEmail = onCall(
  {
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
  },
  async (request) => {
    const data = (request.data || {}) as SuggestionPayload;

    const title = String(data.title || "").trim();
    const schoolName = String(data.schoolName || "").trim();
    const schoolEmail = String(data.schoolEmail || "").trim();
    const notes = String(data.notes || "").trim();

    logger.info("sendSuggestionEmail called", {
      title,
      schoolName,
      schoolEmail,
      hasNotes: !!notes,
    });

    if (!title) {
      throw new HttpsError("invalid-argument", "عنوان المقترح مطلوب.");
    }

    if (!schoolName) {
      throw new HttpsError("invalid-argument", "اسم المدرسة مطلوب.");
    }

    if (!schoolEmail || !isValidEmail(schoolEmail)) {
      throw new HttpsError("invalid-argument", "إيميل المدرسة غير صحيح.");
    }

    if (!notes) {
      throw new HttpsError("invalid-argument", "الملاحظات والاقتراحات مطلوبة.");
    }

    try {
      const gmailUser = GMAIL_USER.value();
      const gmailPass = GMAIL_APP_PASSWORD.value();

      logger.info("Secrets loaded", {
        hasUser: !!gmailUser,
        hasPassword: !!gmailPass,
      });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const subject = `مقترح تطوير البرنامج - ${title}`;

      const textBody = `
تم إرسال مقترح جديد لتطوير النظام

عنوان المقترح: ${title}
اسم المدرسة: ${schoolName}
إيميل المدرسة: ${schoolEmail}

الملاحظات والاقتراحات:
${notes}
      `.trim();

      const htmlBody = `
        <div dir="rtl" style="font-family: Arial, Tahoma, sans-serif; line-height: 1.9; color: #111;">
          <h2 style="margin-bottom: 16px;">مقترح جديد لتطوير النظام</h2>
          <p><strong>عنوان المقترح:</strong> ${title}</p>
          <p><strong>اسم المدرسة:</strong> ${schoolName}</p>
          <p><strong>إيميل المدرسة:</strong> ${schoolEmail}</p>
          <div style="margin-top: 20px;">
            <strong>الملاحظات والاقتراحات:</strong>
            <div style="margin-top: 10px; padding: 14px; background: #f5f5f5; border-radius: 10px; white-space: pre-wrap;">
              ${notes}
            </div>
          </div>
        </div>
      `;

      const info = await transporter.sendMail({
        from: gmailUser,
        to: "3asal2030@gmail.com",
        replyTo: schoolEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });

      logger.info("Email sent successfully", {
        messageId: info.messageId,
      });

      return {
        ok: true,
        message: "تم إرسال المقترح بنجاح.",
      };
    } catch (error: any) {
      logger.error("sendSuggestionEmail failed", error);
      throw new HttpsError("internal", error?.message || "فشل إرسال البريد الإلكتروني.");
    }
  }
);