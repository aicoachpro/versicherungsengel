import { Resend } from "resend";
import { getSetting } from "@/lib/settings";
import { getBranding } from "@/lib/branding";

function getResend() {
  return new Resend(getSetting("email.resendApiKey") || process.env.RESEND_API_KEY);
}

function getFromEmail() {
  return getSetting("email.fromAddress") || process.env.RESEND_FROM || "noreply@example.com";
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName: string
) {
  const b = getBranding();
  const from = getFromEmail();
  await getResend().emails.send({
    from: `${b.companyName} <${from}>`,
    to,
    subject: `Passwort zurücksetzen – ${b.companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: ${b.color};">Passwort zurücksetzen</h2>
        <p>Hallo ${userName},</p>
        <p>Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.</p>
        <p>Klicke auf den folgenden Button, um ein neues Passwort zu vergeben:</p>
        <a href="${resetUrl}" style="display: inline-block; background: ${b.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Neues Passwort setzen
        </a>
        <p style="color: #666; font-size: 14px;">Dieser Link ist 1 Stunde gültig.</p>
        <p style="color: #666; font-size: 14px;">Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">${b.companyName}${b.subtitle ? " – " + b.subtitle : ""}</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(
  to: string,
  setPasswordUrl: string,
  userName: string,
  invitedBy: string
) {
  const b = getBranding();
  const from = getFromEmail();
  await getResend().emails.send({
    from: `${b.companyName} <${from}>`,
    to,
    subject: `Willkommen bei ${b.companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: ${b.color};">Willkommen!</h2>
        <p>Hallo ${userName},</p>
        <p>${invitedBy} hat einen Account für dich erstellt.</p>
        <p>Klicke auf den folgenden Button, um dein Passwort zu vergeben und dich erstmalig anzumelden:</p>
        <a href="${setPasswordUrl}" style="display: inline-block; background: ${b.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Passwort vergeben
        </a>
        <p style="color: #666; font-size: 14px;">Dieser Link ist 24 Stunden gültig.</p>
        <p style="color: #666; font-size: 14px;">Deine Anmelde-E-Mail: <strong>${to}</strong></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">${b.companyName}${b.subtitle ? " – " + b.subtitle : ""}</p>
      </div>
    `,
  });
}
