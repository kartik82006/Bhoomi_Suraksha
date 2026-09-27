import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-only-insecure-secret";

export interface AuthClaims {
  userId: string;
  email: string;
  role: Role;
  stateCode: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const claims = jwt.verify(header.slice("Bearer ".length), ACCESS_SECRET) as AuthClaims;
    req.auth = claims;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Forbidden for this role" });
    }
    next();
  };
}

/**
 * State officials are hard-scoped to their own state regardless of query
 * params; admins pass through unfiltered. Never trust a client-supplied
 * state override (README section 4: "never trust the client").
 */
export function resolveStateScope(auth: AuthClaims, requestedState?: string): string | undefined {
  if (auth.role === "state_official") {
    return auth.stateCode ?? undefined;
  }
  return requestedState;
}
