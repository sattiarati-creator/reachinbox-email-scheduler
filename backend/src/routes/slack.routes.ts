import { Router } from "express";
import {
  getStatus,
  getOAuthUrl,
  handleCallback,
  connectWebhook,
  disconnect,
  testNotification,
} from "../controllers/slack.controller";

const router = Router();

router.get("/status", getStatus);
router.get("/oauth/url", getOAuthUrl);
router.get("/oauth/callback", handleCallback);
router.post("/webhook", connectWebhook);
router.post("/disconnect", disconnect);
router.post("/test", testNotification);

export default router;
