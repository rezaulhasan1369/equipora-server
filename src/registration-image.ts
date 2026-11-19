import type { RequestHandler } from "express";
import { frontendOrigin, HttpError } from "./auth.js";
// Anonymous registration needs an upload before an account exists. Fixed ImgBB
// destination and the existing image validator are retained; quotas precede parsing.
const windows = new Map<string, { until: number; count: number }>();
let globalWindow = { until: 0, count: 0 };
export const registrationImageGuard: RequestHandler = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.get("origin") !== frontendOrigin()) return next(new HttpError(403, "Request origin is not allowed"));
  if (!req.is("application/json") || req.get("content-encoding")) return next(new HttpError(415, "Use an uncompressed JSON image request"));
  const now = Date.now();
  for (const [key, entry] of windows) if (entry.until <= now) windows.delete(key);
  if (globalWindow.until <= now) globalWindow = { until: now + 3600000, count: 0 };
  const key = req.socket.remoteAddress ?? "unknown";
  const entry = windows.get(key) ?? { until: now + 3600000, count: 0 };
  if (entry.count >= 10 || globalWindow.count >= 100 || windows.size >= 1000) {
    res.set("Retry-After", "3600"); return next(new HttpError(429, "Registration upload limit reached. Use an image URL or try later."));
  }
  entry.count++; globalWindow.count++; windows.set(key, entry); next();
};
