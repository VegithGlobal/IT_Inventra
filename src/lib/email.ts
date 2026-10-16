import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

/** SMTP is optional: with no SMTP_HOST, email is simply off and in-app notifications still work. */
export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

export function smtpSummary() {
  if (!emailConfigured()) return null;
  return {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "it-ops-hub@localhost",
  };
}

function getTransporter() {
  if (!transporter) {
    const s = smtpSummary();
    if (!s) throw new Error("SMTP is not configured (set SMTP_HOST in .env).");
    transporter = nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html: string }) {
  const s = smtpSummary();
  if (!s) throw new Error("SMTP is not configured (set SMTP_HOST in .env).");
  await getTransporter().sendMail({ from: s.from, ...opts });
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Minimal, email-client-safe HTML. Email clients ignore CSS variables, so this template
 * uses the theme's literal values (text #111111, muted #5f5f5a, lines #e6e6e1, brand #a3d93b).
 */
export function digestHtml(opts: { heading: string; intro: string; items: { title: string; body?: string | null; url?: string | null }[]; footer: string }) {
  const rows = opts.items
    .map(
      (i) => `<tr><td style="padding:12px 0;border-top:1px solid #e6e6e1">
        <div style="font-size:14px;font-weight:600;color:#111111">${i.url ? `<a href="${esc(i.url)}" style="color:#111111;text-decoration:none">${esc(i.title)}</a>` : esc(i.title)}</div>
        ${i.body ? `<div style="font-size:13px;color:#5f5f5a;margin-top:2px">${esc(i.body)}</div>` : ""}
      </td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f7f7f5;font-family:Inter,Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e6e1;border-radius:12px;padding:24px">
      <tr><td><div style="height:3px;width:40px;background:#a3d93b;border-radius:2px;margin-bottom:16px"></div>
        <div style="font-size:18px;font-weight:600;color:#111111">${esc(opts.heading)}</div>
        <div style="font-size:13px;color:#5f5f5a;margin:4px 0 12px">${esc(opts.intro)}</div></td></tr>
      ${rows}
      <tr><td style="padding-top:16px;border-top:1px solid #e6e6e1;font-size:12px;color:#8f8f89">${esc(opts.footer)}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}
