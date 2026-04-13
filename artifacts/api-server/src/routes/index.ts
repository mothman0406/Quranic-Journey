import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import childrenRouter from "./children.js";
import memorizationRouter from "./memorization.js";
import sessionsRouter from "./sessions.js";
import transcribeRouter from "./transcribe.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(childrenRouter);
router.use(memorizationRouter);
router.use(sessionsRouter);
router.use(transcribeRouter);

export default router;
