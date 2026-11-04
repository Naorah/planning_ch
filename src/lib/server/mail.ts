import { RESEND_API_KEY, RESEND_FROM } from '$app/env/private';
import { Resend } from 'resend';

export async function sendAccessMail(options: {
	to: string;
	displayName: string;
	resetUrl: string;
}) {
	const key = RESEND_API_KEY?.trim();
	const from = RESEND_FROM?.trim();
	if (!key || !from) {
		return { error: 'Envoi email non configuré (RESEND_API_KEY / RESEND_FROM).' };
	}

	const resend = new Resend(key);
	const { error } = await resend.emails.send({
		from,
		to: options.to,
		subject: 'Accès au planning des gardes',
		html: accessMailHtml(options.displayName, options.resetUrl)
	});

	if (error) {
		return { error: 'Envoi du mail impossible.' };
	}
	return { error: '' };
}

function accessMailHtml(displayName: string, resetUrl: string) {
	const safeName = escapeHtml(displayName);
	const safeUrl = escapeHtml(resetUrl);
	return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f3f6f8;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;color:#1c2834;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:420px;background:#ffffff;border-radius:12px;padding:28px 24px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:22px;font-weight:700;line-height:1.25;">Planning</p>
              <p style="margin:0 0 20px;font-size:12px;line-height:1.4;color:#5d6d7e;">Gardes matin et après-midi</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.45;">Bonjour ${safeName},</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.45;color:#5d6d7e;">
                Utilisez le bouton ci-dessous pour définir ou réinitialiser votre mot de passe. Ce lien expire dans 15 minutes.
              </p>
              <a href="${safeUrl}" style="display:inline-block;background:#1a6b7a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;line-height:1;padding:14px 20px;border-radius:8px;">
                Définir mon mot de passe
              </a>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.4;color:#5d6d7e;">
                Si vous n’avez pas demandé cet email, ignorez-le.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
