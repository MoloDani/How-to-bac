// src/auth/mailer.ts
import { Resend } from 'resend';
import { env } from '../env.js';
const resend = new Resend(env.RESEND_API_KEY);
async function send(to, subject, html) {
    const { error } = await resend.emails.send({
        from: env.MAIL_FROM,
        to,
        subject,
        html,
    });
    // Don't throw — a mail outage shouldn't fail a registration. Log and
    // let the user request a resend.
    if (error)
        console.error('[mail] send failed', { to, subject, error });
}
const wrap = (body) => `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;
            margin:0 auto;padding:24px;color:#111">
  ${body}
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
  <p style="font-size:12px;color:#888">
    Dacă nu tu ai cerut acest email, îl poți ignora.
  </p>
</div>`;
const button = (href, label) => `
  <p style="margin:24px 0">
    <a href="${href}" style="background:#111;color:#fff;padding:12px 20px;
       border-radius:8px;text-decoration:none;display:inline-block">${label}</a>
  </p>
  <p style="font-size:12px;color:#666;word-break:break-all">${href}</p>`;
export async function sendVerificationEmail(to, token) {
    const url = `${env.APP_BASE_URL}/verify?token=${encodeURIComponent(token)}`;
    await send(to, 'Confirmă-ți adresa de email', wrap(`
      <h2 style="margin:0 0 8px">Bine ai venit!</h2>
      <p>Confirmă-ți adresa de email ca să îți poți salva progresul.</p>
      ${button(url, 'Confirmă emailul')}
      <p style="font-size:13px;color:#666">Linkul expiră în 24 de ore.</p>
    `));
}
export async function sendPasswordResetEmail(to, token) {
    const url = `${env.APP_BASE_URL}/reset?token=${encodeURIComponent(token)}`;
    await send(to, 'Resetare parolă', wrap(`
      <h2 style="margin:0 0 8px">Resetare parolă</h2>
      <p>Apasă butonul de mai jos ca să îți setezi o parolă nouă.</p>
      ${button(url, 'Setează parola nouă')}
      <p style="font-size:13px;color:#666">Linkul expiră într-o oră.</p>
    `));
}
