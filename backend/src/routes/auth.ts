import crypto from "node:crypto";
import type { Role } from "@prisma/client";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { authenticate, requireRole, type AuthClaims } from "../middleware/auth.js";

const VALID_ROLES: Role[] = ["admin", "state_official", "public_viewer"];

export const authRouter = Router();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-only-insecure-secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-only-insecure-refresh-secret";
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL ?? 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL ?? 1209600);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later" },
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueTokens(claims: AuthClaims) {
  // jwtid makes each token unique even if issued for the same user within the
  // same second — without it, two tokens with identical claims + iat are
  // byte-identical, which collided on the refresh_tokens.tokenHash unique
  // constraint during rapid login/refresh calls.
  const accessToken = jwt.sign(claims, ACCESS_SECRET, { expiresIn: ACCESS_TTL, jwtid: crypto.randomUUID() });
  const refreshToken = jwt.sign(claims, REFRESH_SECRET, { expiresIn: REFRESH_TTL, jwtid: crypto.randomUUID() });

  await prisma.refreshToken.create({
    data: {
      userId: claims.userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in and receive an access + refresh token pair
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Tokens issued }
 *       401: { description: Invalid email or password }
 *       429: { description: Rate limited }
 */
authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordValid = user ? await argon2.verify(user.passwordHash, password) : false;

  if (!user || !passwordValid) {
    // Generic message on failed auth (README section 4) — don't reveal which field was wrong.
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const claims: AuthClaims = { userId: user.id, email: user.email, role: user.role, stateCode: user.stateCode };
  const tokens = await issueTokens(claims);
  res.json({ ...tokens, role: user.role, stateCode: user.stateCode });
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate a refresh token for a new access + refresh token pair
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New tokens issued, old refresh token revoked }
 *       401: { description: Invalid, expired, or already-revoked refresh token }
 */
authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string") {
    return res.status(400).json({ error: "refreshToken is required" });
  }

  try {
    const claims = jwt.verify(refreshToken, REFRESH_SECRET) as AuthClaims;
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    // Rotation: revoke the used token before issuing a new pair.
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const freshClaims: AuthClaims = { userId: claims.userId, email: claims.email, role: claims.role, stateCode: claims.stateCode };
    res.json(await issueTokens(freshClaims));
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       204: { description: Revoked (or already invalid — logout is idempotent) }
 */
authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken === "string") {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.status(204).send();
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Admin-only user creation (README section 4 — no public self-registration)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [admin, state_official, public_viewer] }
 *               stateCode: { type: string, nullable: true }
 *     responses:
 *       201: { description: User created }
 *       403: { description: Caller is not an admin }
 *       409: { description: Email already in use }
 */
authRouter.post("/register", authenticate, requireRole("admin"), async (req, res) => {
  const { email, password, role, stateCode } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `email, password, and role (one of ${VALID_ROLES.join(", ")}) are required` });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, stateCode: stateCode ?? null },
  });

  res.status(201).json({ id: user.id, email: user.email, role: user.role, stateCode: user.stateCode });
});
