import nodemailer from "nodemailer";

export type CompletionMessage = { to: string; subject: string; text: string; html: string; messageId: string };
// Transport-neutral boundary; this phase supplies only a non-delivering mock adapter.
export type CompletionEmailService = {
  mode: "simulation";
  deliver(message: CompletionMessage, options?: { idempotencyKey: string; signal: AbortSignal }): Promise<void>;
};
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function completionTemplate(name: string, equipment: string, role: "customer" | "owner") {
  const sentence = role === "owner" ? `The rental of your equipment, ${equipment}, has completed.` : `Your rental of ${equipment} has completed.`;
  return {
    subject: "Your Equipora rental is complete",
    text: `Hello ${name},\n\n${sentence}\nSign in to Equipora to review your rental history.\n\nEquipora | Rental completion notice`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rental complete</title><style>@media(max-width:600px){.content{padding:20px!important}}</style></head><body style="margin:0;background:#edf2f6;color:#233544;font:16px/1.6 Arial,sans-serif"><main><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><table role="presentation" class="content" style="width:100%;max-width:600px;margin:auto;background:#fff;border:1px solid #cbd5df;border-radius:16px;padding:32px"><tr><td><p style="color:#536477;font-weight:bold">EQUIPORA</p><h1 style="font-size:28px;line-height:1.25">Your rental is complete.</h1><p>Hello ${escape(name)},</p><p>${escape(sentence)}</p><p>Sign in to Equipora to review your rental history.</p><hr style="border:0;border-top:1px solid #cbd5df"><p style="font-size:14px;color:#536477">Equipora | Rental completion notice</p></td></tr></table></td></tr></table></main></body></html>`,
  };
}
export function simulationMailer(inspect?: (message: CompletionMessage) => void): CompletionEmailService {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const sent = new Set<string>(); // Mock provider idempotency, never a claim about SMTP.
  return { mode: "simulation", async deliver(message, options) {
    options?.signal.throwIfAborted();
    const key = options?.idempotencyKey ?? message.messageId;
    if (sent.has(key)) return;
    await transport.sendMail({ from: "Equipora <no-reply@equipora.invalid>", ...message });
    inspect?.(message); sent.add(key);
  } };
}
