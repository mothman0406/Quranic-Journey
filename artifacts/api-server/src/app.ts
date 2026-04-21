import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import router from "./routes/index.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Allow requests from the local browser and LAN-loaded phone dev server.
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://10.100.148.251:5173",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Better Auth handles all /api/auth/* routes (sign-in, sign-up, sign-out, session)
app.all("/api/auth/*splat", toNodeHandler(auth));

// All other /api/* routes require a valid session
app.use("/api", requireAuth, router);

export default app;
