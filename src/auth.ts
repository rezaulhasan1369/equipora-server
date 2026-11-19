import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { toNodeHandler } from "better-auth/node";
import { createLocalJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import type { Request, Response, NextFunction } from "express";
import { getClient } from "./db.js";
import type { Role } from "./domain.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    public safeMessage: string,
  ) {
    super(safeMessage);
  }
}
function origin(value: string | undefined) {
  if (!value) throw new HttpError(503, "Authentication is not configured");
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    (u.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      ))
  )
    throw new HttpError(503, "Authentication configuration is invalid");
  return u.origin;
}
export function frontendOrigin() {
  return origin(process.env.FRONTEND_URL);
}
function makeAuth(client: Awaited<ReturnType<typeof getClient>>) {
  const baseURL = origin(
      process.env.AUTH_PUBLIC_URL ?? process.env.FRONTEND_URL,
    ),
    secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new HttpError(503, "Authentication is not configured");
  return betterAuth({
    baseURL,
    secret,
    database: mongodbAdapter(client.db("equipora"), { client }),
    trustedOrigins: [frontendOrigin()],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    socialProviders:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},
    user: {
      additionalFields: {
        role: { type: "string", defaultValue: "customer", input: false },
        phone: { type: "string", required: false },
        address: { type: "string", required: false },
        disabled: { type: "boolean", defaultValue: false, input: false },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          if (
            !/[A-Z]/.test(ctx.body?.password ?? "") ||
            !/[a-z]/.test(ctx.body?.password ?? "") ||
            (ctx.body?.password?.length ?? 0) < 6
          )
            throw new APIError("BAD_REQUEST", {
              message:
                "Password needs uppercase, lowercase, and at least 6 characters",
            });
          if (
            typeof ctx.body?.image !== "string" || !ctx.body.image.trim() || ctx.body.image.length > 2048 ||
            !URL.canParse(ctx.body.image) || new URL(ctx.body.image).protocol !== "https:" ||
            Boolean(new URL(ctx.body.image).username || new URL(ctx.body.image).password)
          )
            throw new APIError("BAD_REQUEST", {
              message: "A valid HTTPS profile image is required",
            });
        }
      }),
    },
    plugins: [
      jwt({
        jwt: {
          issuer: baseURL,
          audience: baseURL,
          expirationTime: "15m",
          definePayload: ({ user, session }) => ({
            sessionId: session.id,
            role: user.role,
          }),
        },
      }),
    ],
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    advanced: { useSecureCookies: baseURL.startsWith("https:") },
    logger: { disabled: true },
    rateLimit: {
      enabled: process.env.NODE_ENV !== "test",
      window: 60,
      max: 60,
    },
  });
}
let cached: Promise<ReturnType<typeof makeAuth>> | undefined;
export function getAuth() {
  if (!cached)
    cached = (async () => {
      frontendOrigin();
      if (
        !process.env.BETTER_AUTH_SECRET ||
        process.env.BETTER_AUTH_SECRET.length < 32
      )
        throw new HttpError(503, "Authentication is not configured");
      return makeAuth(await getClient());
    })().catch((e) => {
      cached = undefined;
      throw e;
    });
  return cached;
}
export async function authHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await toNodeHandler(await getAuth())(req, res);
  } catch (e) {
    next(e);
  }
}
export type Principal = {
  id: string;
  role: Role;
  name: string;
  email: string;
  image?: string;
};
declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
export async function verifyToken(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer ") || header.length > 8192)
      throw new HttpError(401, "Please sign in");
    const auth = await getAuth(),
      base = origin(process.env.AUTH_PUBLIC_URL ?? process.env.FRONTEND_URL);
    let payload;
    try {
      ({ payload } = await jwtVerify(
        header.slice(7),
        createLocalJWKSet(await auth.api.getJwks()),
        {
          issuer: base,
          audience: base,
          algorithms: ["EdDSA", "ES256", "RS256"],
        },
      ));
    } catch {
      throw new HttpError(401, "Session is invalid or expired");
    }
    if (
      typeof payload.sub !== "string" ||
      !ObjectId.isValid(payload.sub) ||
      typeof payload.sessionId !== "string" ||
      !ObjectId.isValid(payload.sessionId)
    )
      throw new HttpError(401, "Session is invalid");
    const db = (await getClient()).db("equipora");
    const [user, session] = await Promise.all([
      db.collection("user").findOne({ _id: new ObjectId(payload.sub) }),
      db.collection("session").findOne({
        _id: new ObjectId(payload.sessionId),
        userId: new ObjectId(payload.sub),
        expiresAt: { $gt: new Date() },
      }),
    ]);
    if (
      !user ||
      user.disabled ||
      !session ||
      !["customer", "owner", "admin"].includes(user.role)
    )
      throw new HttpError(401, "Session is no longer active");
    req.principal = {
      id: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      image: user.image,
    };
    next();
  } catch (e) {
    next(e);
  }
}
export function permit(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) =>
    req.principal && roles.includes(req.principal.role)
      ? next()
      : next(new HttpError(403, "You do not have permission for this action"));
}
export const verifyRenter = permit("customer"),
  verifyOwner = permit("owner"),
  verifyAdmin = permit("admin");
