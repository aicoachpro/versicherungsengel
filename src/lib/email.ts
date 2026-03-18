import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM || "noreply@voelkergroup.cloud";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  userName: string
) {
  await resend.emails.send({
    from: `VÖLKER Finance <${fromEmail}>`,
    to,
    subject: "Passwort zurücksetzen – VÖLKER Finance Sales Hub",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #003781;">Passwort zurücksetzen</h2>
        <p>Hallo ${userName},</p>
        <p>Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.</p>
        <p>Klicke auf den folgenden Button, um ein neues Passwort zu vergeben:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #003781; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Neues Passwort setzen
        </a>
        <p style="color: #666; font-size: 14px;">Dieser Link ist 1 Stunde gültig.</p>
        <p style="color: #666; font-size: 14px;">Falls du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">VÖLKER Finance OHG – Sales Hub</p>
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
  await resend.emails.send({
    from: `VÖLKER Finance <${fromEmail}>`,
    to,
    subject: "Willkommen im VÖLKER Finance Sales Hub",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #003781;">Willkommen im Sales Hub!</h2>
        <p>Hallo ${userName},</p>
        <p>${invitedBy} hat einen Account für dich erstellt.</p>
        <p>Klicke auf den folgenden Button, um dein Passwort zu vergeben und dich erstmalig anzumelden:</p>
        <a href="${setPasswordUrl}" style="display: inline-block; background: #003781; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Passwort vergeben
        </a>
        <p style="color: #666; font-size: 14px;">Dieser Link ist 24 Stunden gültig.</p>
        <p style="color: #666; font-size: 14px;">Deine Anmelde-E-Mail: <strong>${to}</strong></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">VÖLKER Finance OHG – Sales Hub</p>
      </div>
    `,
  });
}
