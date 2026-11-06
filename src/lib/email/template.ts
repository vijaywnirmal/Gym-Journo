// The one layout for emails the app sends. Inline styles and a table, because email apps ignore most
// else. Names in the text come from people (a gym's name), so everything is escaped.
export type EmailContent = {
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
};

const PRODUCT_NAME = "GymJourno";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail({ title, body, buttonLabel, buttonUrl }: EmailContent): {
  subject: string;
  html: string;
  text: string;
} {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:24px;${font}">
<p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#6e6e73;">${PRODUCT_NAME}</p>
<h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#1d1d1f;">${escapeHtml(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#1d1d1f;">${escapeHtml(body)}</p>
<a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1d1d1f;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">${escapeHtml(buttonLabel)}</a>
</td></tr>
</table>
<p style="margin:16px 0 0;max-width:480px;font-size:13px;line-height:1.5;color:#6e6e73;${font}">You're getting this because it's about your ${PRODUCT_NAME} account.</p>
</td></tr>
</table>
</body>
</html>
`;
  return {
    subject: title,
    html,
    text: `${title}\n\n${body}\n\n${buttonLabel}: ${buttonUrl}\n\nYou're getting this because it's about your ${PRODUCT_NAME} account.\n`,
  };
}
