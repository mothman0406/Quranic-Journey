import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import childrenRouter from "./children.js";
import memorizationRouter from "./memorization.js";
import sessionsRouter from "./sessions.js";
import duasRouter from "./duas.js";
import storiesRouter from "./stories.js";
import transcribeRouter from "./transcribe.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(childrenRouter);
router.use(memorizationRouter);
router.use(storiesRouter);
router.use(sessionsRouter);
router.use(duasRouter);
router.use(transcribeRouter);

export default router;
