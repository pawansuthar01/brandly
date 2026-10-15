export type BrandlyNotificationContent = {
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character] ?? character);

const safeAction = ({ actionLabel, actionUrl }: BrandlyNotificationContent) =>
  actionLabel?.trim() && actionUrl && /^https:\/\//i.test(actionUrl)
    ? { label: actionLabel.trim(), url: actionUrl }
    : undefined;

export function formatBrandlyEmail(content: BrandlyNotificationContent) {
  const title = escapeHtml(content.title);
  const body = escapeHtml(content.body).replace(/\r?\n/g, "<br />");
  const action = safeAction(content);
  const actionHtml = action
    ? `<tr><td style="padding:0 32px 28px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#5c5fc1;color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(action.label)}</a></td></tr>`
    : "";
  const actionText = action ? `\n\n${action.label}: ${action.url}` : "";
  return {
    text: `BRANDLY\n\n${content.title}\n\n${content.body}${actionText}\n\nA message from the Brandly team.`,
    html: `<!doctype html><html><body style="margin:0;background:#f3f4fa;font-family:Arial,sans-serif;color:#24243a"><span style="display:none;max-height:0;overflow:hidden">A Brandly update: ${title}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4fa;padding:28px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden"><tr><td style="padding:22px 32px;background:#5c5fc1;color:#ffffff"><div style="font-size:20px;font-weight:800;letter-spacing:1px">BRANDLY</div><div style="margin-top:5px;font-size:13px;opacity:.9">Creator partnerships, made clearer.</div></td></tr><tr><td style="padding:30px 32px 12px"><div style="margin-bottom:10px;color:#5c5fc1;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Account update</div><h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#24243a">${title}</h1><div style="font-size:15px;line-height:1.7;color:#56566b">${body}</div></td></tr>${actionHtml}<tr><td style="padding:18px 32px;border-top:1px solid #ececf3;color:#77778a;font-size:12px;line-height:1.6">You received this update from Brandly.<br />Please reply in the app if you need help.</td></tr></table></td></tr></table></body></html>`,
  };
}

export function formatBrandlyWhatsApp(content: BrandlyNotificationContent) {
  const action = safeAction(content);
  return [
    "🔔 Brandly",
    "",
    content.title.trim(),
    "",
    content.body.trim(),
    ...(action ? ["", `${action.label}: ${action.url}`] : []),
    "",
    "Brandly Team",
  ].join("\n");
}
