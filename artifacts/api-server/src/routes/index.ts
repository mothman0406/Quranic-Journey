import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import childrenRouter from "./children.js";
import memorizationRouter from "./memorization.js";
import sessionsRouter from "./sessions.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(childrenRouter);
router.use(memorizationRouter);
router.use(sessionsRouter);

export default router;
