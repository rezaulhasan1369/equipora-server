import { parse } from "dotenv";
// Documented server-side test keys only; never normalize or rewrite a key.
export function isStripeTestSecret(value: unknown): value is string {
  return typeof value === "string" && value.length <= 4096 &&
    /^(?:sk_test_|rkcs_test_)[A-Za-z0-9]+$/.test(value) && value.trim() === value;
}
export const providerNames = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "IMGBB_API_KEY",
] as const;
export function validateProviders(input: Record<string, unknown>) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid provider configuration");
  if (
    Object.keys(input).some(
      (key) => !providerNames.includes(key as (typeof providerNames)[number]),
    )
  )
    throw new Error("Unsupported provider configuration field");
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value !== "string" ||
      value.length > 4096 ||
      /[\r\n\0]/.test(value)
    )
      throw new Error("Invalid provider configuration");
    if (value) values[key] = value;
  }
  if (Boolean(values.GOOGLE_CLIENT_ID) !== Boolean(values.GOOGLE_CLIENT_SECRET))
    throw new Error("Google requires both credential fields");
  if (
    values.GOOGLE_CLIENT_ID &&
    !values.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
  )
    throw new Error("Invalid Google client identifier");
  if (
    values.STRIPE_SECRET_KEY &&
    !isStripeTestSecret(values.STRIPE_SECRET_KEY)
  )
    throw new Error("Only Stripe test credentials are accepted");
  if (
    values.STRIPE_WEBHOOK_SECRET &&
    !values.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
  )
    throw new Error("Invalid Stripe webhook credential");
  return values;
}
export function providerJSON(text: string) {
  try {
    if (Buffer.byteLength(text) > 24576) throw new Error();
    return validateProviders(JSON.parse(text));
  } catch {
    throw new Error("Invalid private provider configuration");
  }
}
export function providerText(text: string) {
  if (Buffer.byteLength(text) > 24576)
    throw new Error("Provider configuration is too large");
  return validateProviders(parse(text));
}
