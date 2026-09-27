import { Router } from "express";
import { scheduleEmail } from "../controllers/email.controller";

const router = Router();

router.post("/schedule", scheduleEmail);

export default router;