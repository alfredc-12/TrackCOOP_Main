/**
 * The one HTML frame every TrackCOOP email uses (membership, rental, store, activation).
 *
 * Email clients are not browsers: layout is nested tables, styles are inline, buttons are solid colours (gradients
 * and shadows are dropped by Outlook), and the card fits a 320px phone without horizontal scrolling. Colours
 * follow the TrackCOOP palette: forest #123D2A, green #1F6B43, soft green #F7FBF5, border #DDE8D8.
 */

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes plain text and keeps its line breaks. */
export function linesToHtml(value: string) {
  return escapeHtml(value)
    .split(/\r?\n/)
    .map((line) => line || "&nbsp;")
    .join("<br>");
}

export type EmailDetail = { label: string; value: string };

export type EmailLayoutInput = {
  /** Small label above the title, for example "TrackCOOP Rentals". */
  eyebrow: string;
  title: string;
  /** Preview text shown next to the subject in the inbox. */
  preheader?: string;
  /** Plain text. */
  greeting?: string;
  /** Trusted HTML (already escaped by the caller). */
  introHtml?: string;
  detailsTitle?: string;
  /** Plain text, escaped here. */
  details?: EmailDetail[];
  /** Trusted HTML shown between the details and the button (a table, a quoted instruction ...). */
  extraHtml?: string;
  button?: { label: string; url: string };
  /** Plain text. */
  note?: string;
};

const FONT = "Arial,Helvetica,sans-serif";

function detailsBlock(title: string | undefined, details: EmailDetail[]) {
  if (!details.length) return "";
  const rows = details
    .map((detail, index) => {
      const border = index === details.length - 1 ? "" : "border-bottom:1px solid #E3EDDF;";
      return `<tr>
                    <td valign="top" width="38%" style="padding:11px 12px 11px 0;${border}color:#6D8978;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${escapeHtml(detail.label)}</td>
                    <td valign="top" style="padding:11px 0;${border}color:#123D2A;font-size:15px;line-height:1.45;font-weight:700;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(detail.value)}</td>
                  </tr>`;
    })
    .join("\n                  ");
  const heading = title
    ? `<p style="margin:0 0 4px;color:#1F6B43;font-size:12px;line-height:1.2;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(title)}</p>`
    : "";
  return `<tr>
              <td style="padding:22px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#F7FBF5;border:1px solid #DDE8D8;border-radius:10px;">
                  <tr><td style="padding:16px 18px 6px;">${heading}</td></tr>
                  <tr><td style="padding:0 18px 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  ${rows}
                    </table>
                  </td></tr>
                </table>
              </td>
            </tr>`;
}

export function renderEmailLayout(input: EmailLayoutInput) {
  const title = escapeHtml(input.title);
  const preheader = input.preheader ? escapeHtml(input.preheader) : "";
  const button = input.button
    ? `<tr>
              <td align="center" style="padding:26px 28px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:separate;">
                  <tr>
                    <td align="center" bgcolor="#1F6B43" style="border-radius:8px;background:#1F6B43;">
                      <a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:14px 30px;color:#FFFFFF;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(input.button.label)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:14px 28px 0;">
                <p style="margin:0;color:#7B8D82;font-size:12px;line-height:1.5;">If the button does not work, copy and paste this link into your browser:</p>
                <a href="${escapeHtml(input.button.url)}" style="color:#1F6B43;font-size:12px;line-height:1.6;text-decoration:underline;word-break:break-all;">${escapeHtml(input.button.url)}</a>
              </td>
            </tr>`
    : "";
  const note = input.note
    ? `<tr>
              <td style="padding:24px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F4F8F1;">
                  <tr>
                    <td width="4" bgcolor="#65B96E" style="background:#65B96E;font-size:0;line-height:0;">&nbsp;</td>
                    <td style="padding:12px 16px;color:#365F4A;font-size:13px;line-height:1.55;">${escapeHtml(input.note)}</td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";
  const greeting = input.greeting
    ? `<p style="margin:0 0 12px;color:#123D2A;font-size:16px;line-height:1.5;font-weight:700;">${escapeHtml(input.greeting)}</p>`
    : "";
  const intro = input.introHtml
    ? `<p style="margin:0;color:#3F5A4B;font-size:15px;line-height:1.65;overflow-wrap:anywhere;word-break:break-word;">${input.introHtml}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#EEF3EA;font-family:${FONT};color:#123D2A;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#EEF3EA;">
      <tr>
        <td align="center" style="padding:24px 12px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:separate;border-spacing:0;background:#FFFFFF;border:1px solid #DDE8D8;border-radius:12px;overflow:hidden;">
            <tr>
              <td bgcolor="#123D2A" style="background:#123D2A;padding:20px 28px;">
                <p style="margin:0;color:#FFFFFF;font-size:20px;line-height:1.2;font-weight:800;letter-spacing:0.01em;">TrackCOOP</p>
                <p style="margin:5px 0 0;color:#9BCC8D;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 0;">
                <h1 style="margin:0;color:#123D2A;font-size:26px;line-height:1.2;font-weight:800;">${title}</h1>
                <div style="width:56px;height:3px;margin:14px 0 0;background:#9BCC8D;font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;">
                ${greeting}
                ${intro}
              </td>
            </tr>
            ${detailsBlock(input.detailsTitle, input.details ?? [])}
            ${input.extraHtml ? `<tr><td style="padding:22px 28px 0;">${input.extraHtml}</td></tr>` : ""}
            ${button}
            ${note}
            <tr>
              <td style="padding:28px 28px 26px;">
                <div style="border-top:1px solid #E3EDDF;font-size:0;line-height:0;">&nbsp;</div>
                <p style="margin:14px 0 0;color:#7B8D82;font-size:12px;line-height:1.6;">This is an automated message from TrackCOOP. Reply to this email if you need help and our support team will get back to you.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
