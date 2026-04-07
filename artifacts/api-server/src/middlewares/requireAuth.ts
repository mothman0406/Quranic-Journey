import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

// Augment Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };

  next();
}
