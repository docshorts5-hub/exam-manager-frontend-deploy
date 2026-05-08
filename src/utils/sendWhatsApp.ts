function sanitizePhone(phone?: string): string {
  let clean = String(phone || "").replace(/[^0-9]/g, "");

  if (clean.length === 8) clean = `968${clean}`;
  if (clean.startsWith("0") && clean.length >= 9) clean = `968${clean.slice(1)}`;

  return clean;
}

async function copyTextSafely(text: string): Promise<void> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // Clipboard is optional. WhatsApp link still opens normally.
  }
}

export async function sendWhatsApp(phone: string | undefined, message: string): Promise<void> {
  const cleanPhone = sanitizePhone(phone);
  const safeMessage = String(message || "").trim();
  const encodedMessage = encodeURIComponent(safeMessage);

  // wa.me can fail with ERR_CONNECTION_RESET on some networks, so we open WhatsApp Web directly.
  const url = cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
    : `https://web.whatsapp.com/send?text=${encodedMessage}`;

  await copyTextSafely(safeMessage);

  const popup = window.open(
    "about:blank",
    "_blank",
    "noopener,noreferrer,width=1100,height=800,top=40,left=80,resizable=yes,scrollbars=yes"
  );

  if (!popup) {
    alert("تم نسخ رسالة الواتساب. المتصفح منع فتح نافذة واتساب، افتح واتساب Web والصق الرسالة.");
    return;
  }

  popup.location.href = url;
}
