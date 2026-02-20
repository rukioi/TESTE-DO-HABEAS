/**
 * Template HTML do email de recuperação de senha.
 * Paletas: Preto #000000/#1B223C, Laranja #e19a00 (hover #c78b00), Alternativo #F5A100/#FFB733
 */

export interface ForgotPasswordEmailParams {
  userName: string;
  resetLink: string;
  fromEmail: string;
}

export function getForgotPasswordEmailHtml(params: ForgotPasswordEmailParams): string {
  const { userName, resetLink, fromEmail } = params;

  // Nome para saudação: primeiro nome ou "usuário"
  const firstName = (userName || 'usuário').trim().split(/\s+/)[0] || userName || 'usuário';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperação de Senha - Habeas Desk</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: #0d0f1a;
      font-family: 'DM Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      background-image:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(225, 154, 0, 0.12) 0%, transparent 60%),
        radial-gradient(ellipse 40% 40% at 90% 80%, rgba(27, 34, 60, 0.8) 0%, transparent 60%);
    }

    .wrapper {
      width: 100%;
      max-width: 560px;
    }

    .email-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo-container {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }

    .logo-text {
      font-family: 'Syne', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.3px;
    }

    .logo-text span {
      color: #e19a00;
    }

    .card {
      background: #12162b;
      border: 1px solid rgba(225, 154, 0, 0.15);
      border-radius: 20px;
      overflow: hidden;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.03),
        0 24px 60px rgba(0,0,0,0.5),
        0 0 80px rgba(225, 154, 0, 0.05);
    }

    .card-top-bar {
      height: 3px;
      background: linear-gradient(90deg, transparent, #e19a00, #c78b00, transparent);
    }

    .card-body {
      padding: 48px 48px 40px;
    }

    .icon-circle {
      width: 64px;
      height: 64px;
      background-color: rgba(225, 154, 0, 0.15);
      border: 2px solid #e19a00;
      border-radius: 16px;
      margin-bottom: 28px;
      text-align: center;
      vertical-align: middle;
    }

    .icon-envelope {
      font-size: 36px;
      line-height: 64px;
      color: #e19a00;
    }

    .expiry-icon {
      font-size: 18px;
      color: #e19a00;
      line-height: 1.4;
    }

    .from-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 6px;
      padding: 5px 12px;
      margin-bottom: 28px;
    }

    .from-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #e19a00;
      box-shadow: 0 0 8px rgba(225,154,0,0.6);
    }

    .from-text {
      font-size: 12px;
      color: rgba(255,255,255,0.45);
      font-weight: 400;
      letter-spacing: 0.2px;
    }

    .from-email {
      color: rgba(255,255,255,0.7);
      font-weight: 500;
    }

    .greeting {
      font-family: 'Syne', sans-serif;
      font-size: 26px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .greeting span {
      color: #e19a00;
    }

    .body-text {
      font-size: 15px;
      color: rgba(255,255,255,0.55);
      line-height: 1.7;
      margin-bottom: 36px;
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, rgba(225,154,0,0.2), transparent);
      margin-bottom: 36px;
    }

    .link-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: rgba(255,255,255,0.3);
      font-weight: 500;
      margin-bottom: 12px;
    }

    .cta-btn {
      display: block;
      width: 100%;
      text-align: center;
      padding: 16px 24px;
      background: #e19a00;
      color: #000000;
      text-decoration: none;
      font-family: 'Syne', sans-serif;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(225, 154, 0, 0.45);
      cursor: pointer;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }

    .cta-btn:hover {
      background: #c78b00;
      box-shadow: 0 6px 18px rgba(225, 154, 0, 0.5);
    }

    .url-fallback {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 32px;
    }

    .url-label {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    .url-text {
      font-size: 12px;
      color: #e19a00;
      word-break: break-all;
      font-family: 'DM Sans', monospace;
      opacity: 0.8;
    }

    .expiry-notice {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: rgba(225,154,0,0.06);
      border: 1px solid rgba(225,154,0,0.15);
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 32px;
    }

    .expiry-text {
      font-size: 13px;
      color: rgba(255,255,255,0.45);
      line-height: 1.5;
    }

    .expiry-text strong {
      color: rgba(255,255,255,0.65);
    }

    .card-footer {
      border-top: 1px solid rgba(255,255,255,0.05);
      padding: 24px 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .footer-ignore {
      font-size: 12px;
      color: rgba(255,255,255,0.25);
      line-height: 1.5;
      max-width: 300px;
    }

    .footer-team {
      font-family: 'Syne', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.2);
      white-space: nowrap;
    }

    .footer-team span {
      color: rgba(225,154,0,0.5);
    }

    .outer-footer {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: rgba(255,255,255,0.15);
    }

    @media (max-width: 560px) {
      .card-body { padding: 36px 28px 32px; }
      .card-footer { padding: 20px 28px; flex-direction: column; gap: 12px; text-align: center; }
      .footer-ignore { max-width: 100%; }
      .greeting { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">

    <div class="email-header">
      <div class="logo-container">
        <span class="logo-text">Habeas<span>Desk</span></span>
      </div>
    </div>

    <div class="card">
      <div class="card-top-bar"></div>

      <div class="card-body">

        <div style="width: 64px; height: 64px; background-color: #1B223C; border: 2px solid #e19a00; border-radius: 16px; text-align: center; margin-bottom: 28px; line-height: 64px;">
          <span style="font-size: 36px; color: #e19a00;">&#9993;</span>
        </div>

        <div class="from-badge">
          <div class="from-dot"></div>
          <span class="from-text">De: <span class="from-email">${fromEmail}</span></span>
        </div>

        <h1 class="greeting">Olá, <span>${firstName}.</span></h1>

        <p class="body-text">
          Você solicitou a recuperação de senha no <strong style="color:rgba(255,255,255,0.75)">Habeas Desk</strong>.
          Clique no botão abaixo para definir uma nova senha. Este link é válido por <strong style="color:rgba(255,255,255,0.75)">1 hora</strong>.
        </p>

        <div class="divider"></div>

        <div class="link-label">Ação necessária</div>

        <a href="${resetLink}" class="cta-btn">
          &#128274; &nbsp; Redefinir minha senha
        </a>

        <div class="url-fallback">
          <div class="url-label">Ou copie o link abaixo:</div>
          <div class="url-text">${resetLink}</div>
        </div>

        <div class="expiry-notice">
          <span class="expiry-icon" style="font-size: 18px; color: #e19a00;">&#128340;</span>
          <p class="expiry-text">
            <strong>Este link expira em 1 hora</strong> e só pode ser utilizado uma única vez.
            Após a redefinição, o link será invalidado automaticamente.
          </p>
        </div>

      </div>

      <div class="card-footer">
        <p class="footer-ignore">
          Se você não solicitou a recuperação de senha, ignore este e-mail. Sua senha permanece a mesma.
        </p>
        <div class="footer-team">
          — Equipe <span>HabeasDesk</span>
        </div>
      </div>
    </div>

    <div class="outer-footer">
      &copy; ${new Date().getFullYear()} Habeas Desk &middot; ${fromEmail}
    </div>

  </div>
</body>
</html>`;
}
