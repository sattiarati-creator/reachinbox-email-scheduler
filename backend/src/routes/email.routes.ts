import { Router } from "express";
import {
  scheduleEmail,
  getScheduledEmails,
  getSentEmails,
  searchAllEmails,
  getStats,
  cancelEmail,
} from "../controllers/email.controller";

const router = Router();

router.post("/schedule", scheduleEmail);
router.get("/scheduled", getScheduledEmails);
router.get("/sent", getSentEmails);
router.get("/search", searchAllEmails);
router.get("/stats", getStats);
router.post("/cancel/:id", cancelEmail);

export default router;