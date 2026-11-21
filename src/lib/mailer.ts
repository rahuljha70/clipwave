/**
 * Transactional email.
 *  - RESEND_API_KEY set  -> delivered through Resend's HTTP API.
 *  - otherwise           -> written to data/outbox/*.eml and logged, so local
 *                           development and self-hosted setups never silently fail.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(mail: Mail): Promise<{ delivered: boolean; transport: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: env.emailFrom,
          to: mail.to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
      return { delivered: res.ok, transport: "resend" };
    } catch {
      return { delivered: false, transport: "resend" };
    }
  }

  const outbox = path.resolve("data/outbox");
  await fs.mkdir(outbox, { recursive: true });
  const file = path.join(outbox, `${Date.now()}-${mail.to.replace(/[^a-z0-9]/gi, "_")}.eml`);
  await fs.writeFile(
    file,
    `To: ${mail.to}\nFrom: ${env.emailFrom}\nSubject: ${mail.subject}\nContent-Type: text/html\n\n${mail.html}`,
  );
  console.log(`[mailer] no RESEND_API_KEY — email written to ${file}`);
  return { delivered: false, transport: "outbox" };
}
