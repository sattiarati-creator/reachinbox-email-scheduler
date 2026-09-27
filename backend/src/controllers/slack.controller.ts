import { Request, Response } from "express";
import {
  getSlackOAuthUrl,
  handleSlackOAuthCallback,
  saveSlackWebhook,
  getSlackStatus,
  disconnectSlack,
  sendTestSlackNotification,
} from "../services/slack.service";

export async function getStatus(_req: Request, res: Response) {
  try {
    const status = await getSlackStatus();
    return res.json({ success: true, ...status });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getOAuthUrl(_req: Request, res: Response) {
  try {
    const url = getSlackOAuthUrl();
    return res.json({ success: true, url });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function handleCallback(req: Request, res: Response) {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.redirect("/?slack_error=no_code");
    }

    await handleSlackOAuthCallback(code);
    return res.redirect("/?slack=connected");
  } catch (err: any) {
    console.error("[Slack OAuth] Callback error:", err.message);
    return res.redirect(`/?slack_error=${encodeURIComponent(err.message)}`);
  }
}

export async function connectWebhook(req: Request, res: Response) {
  try {
    const { webhookUrl, channelName } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, message: "webhookUrl is required" });
    }

    const saved = await saveSlackWebhook(webhookUrl, channelName);
    return res.json({ success: true, message: "Slack webhook connected successfully", integration: saved });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

export async function disconnect(_req: Request, res: Response) {
  try {
    await disconnectSlack();
    return res.json({ success: true, message: "Slack disconnected successfully" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function testNotification(_req: Request, res: Response) {
  try {
    const sent = await sendTestSlackNotification();
    return res.json({ success: sent, message: "Test Slack message sent successfully" });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
}
