import { logger } from "./logger.js";

type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export function isEmailDeliveryConfigured() {
  return !!(process.env.RESEND_API_KEY && (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL));
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL;

  if (!isEmailDeliveryConfigured() || !apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn({ to, subject, text }, "Email delivery is not configured; logging email instead");
      return;
    }

    throw new Error("Email delivery is not configured");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error({ status: response.status, body }, "Email provider rejected message");
    throw new Error("Email delivery failed");
  }
}

export async function sendPasswordResetEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  const escapedUrl = escapeHtml(url);

  await sendEmail({
    to,
    subject: "Reset your NoorPath password",
    text: [
      "Assalamu alaikum,",
      "",
      "Use this link to reset your NoorPath password:",
      url,
      "",
      "This link expires in 1 hour. If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Assalamu alaikum,</p>
      <p>Use this link to reset your NoorPath password:</p>
      <p><a href="${escapedUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
