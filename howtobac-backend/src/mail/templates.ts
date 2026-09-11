export interface MailContent {
  subject: string;
  html: string;
}

const wrap = (body: string) => `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;
            margin:0 auto;padding:24px;color:#111">
  ${body}
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
  <p style="font-size:12px;color:#888">
    Dacă nu tu ai cerut acest email, îl poți ignora.
  </p>
</div>`;

const button = (href: string, label: string) => `
  <p style="margin:24px 0">
    <a href="${href}" style="background:#111;color:#fff;padding:12px 20px;
       border-radius:8px;text-decoration:none;display:inline-block">${label}</a>
  </p>
  <p style="font-size:12px;color:#666;word-break:break-all">${href}</p>`;

export const verificationEmail = (url: string): MailContent => ({
  subject: 'Confirmă-ți adresa de email',
  html: wrap(`
    <h2 style="margin:0 0 8px">Bine ai venit!</h2>
    <p>Confirmă-ți adresa de email ca să te poți autentifica.</p>
    ${button(url, 'Confirmă emailul')}
    <p style="font-size:13px;color:#666">Linkul expiră în 24 de ore.</p>
  `),
});

export const passwordResetEmail = (url: string): MailContent => ({
  subject: 'Resetare parolă',
  html: wrap(`
    <h2 style="margin:0 0 8px">Resetare parolă</h2>
    <p>Apasă butonul de mai jos ca să îți setezi o parolă nouă.</p>
    ${button(url, 'Setează parola nouă')}
    <p style="font-size:13px;color:#666">Linkul expiră într-o oră.</p>
  `),
});

export const accountExistsEmail = (
  loginUrl: string,
  forgotUrl: string,
): MailContent => ({
  subject: 'Ai deja un cont',
  html: wrap(`
    <h2 style="margin:0 0 8px">Ai deja un cont</h2>
    <p>Cineva a încercat să creeze un cont nou cu această adresă de email,
       dar ea este deja înregistrată.</p>
    ${button(loginUrl, 'Autentifică-te')}
    <p style="font-size:13px;color:#666">
      Ți-ai uitat parola? <a href="${forgotUrl}">Resetează-o aici</a>.
    </p>
  `),
});
