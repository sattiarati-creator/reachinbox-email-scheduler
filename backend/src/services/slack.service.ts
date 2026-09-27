import axios from "axios";
import dotenv from "dotenv";
import { pool } from "../db/pool";
import { redisConnection } from "../config/redis";

dotenv.config();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || "";
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || "";
const SLACK_REDIRECT_URI =
  process.env.SLACK_REDIRECT_URI || "http://localhost:5000/api/slack/oauth/callback";

export function getSlackOAuthUrl(): string {
  if (!SLACK_CLIENT_ID) {
    return "";
  }
  const scope = "incoming-webhook,chat:write";
  return `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
    SLACK_CLIENT_ID
  )}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(
    SLACK_REDIRECT_URI
  )}`;
}

export async function handleSlackOAuthCallback(code: string) {
  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    throw new Error("Slack OAuth credentials are not configured in environment");
  }

  const response = await axios.post(
    "https://slack.com/api/oauth.v2.access",
    new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || "Unknown error"}`);
  }

  const teamId = data.team?.id || null;
  const teamName = data.team?.name || null;
  const channelId = data.incoming_webhook?.channel_id || null;
  const channelName = data.incoming_webhook?.channel || null;
  const accessToken = data.access_token || null;
  const webhookUrl = data.incoming_webhook?.url || null;

  // Deactivate existing and insert active
  await pool.query("UPDATE slack_integrations SET is_active = false");
  const result = await pool.query(
    `
    INSERT INTO slack_integrations (
      team_id, team_name, channel_id, channel_name, access_token, webhook_url, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, true)
    RETURNING *
    `,
    [teamId, teamName, channelId, channelName, accessToken, webhookUrl]
  );

  return result.rows[0];
}

export async function saveSlackWebhook(webhookUrl: string, channelName = "General") {
  if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
    throw new Error("Invalid Slack Incoming Webhook URL");
  }

  await pool.query("UPDATE slack_integrations SET is_active = false");
  const result = await pool.query(
    `
    INSERT INTO slack_integrations (
      team_name, channel_name, webhook_url, is_active
    )
    VALUES ($1, $2, $3, true)
    RETURNING *
    `,
    ["Connected Workspace", channelName, webhookUrl]
  );

  return result.rows[0];
}

export async function getSlackStatus() {
  const result = await pool.query(
    "SELECT id, team_name, channel_name, webhook_url, is_active, updated_at FROM slack_integrations WHERE is_active = true ORDER BY id DESC LIMIT 1"
  );

  if (result.rows.length === 0) {
    return {
      connected: false,
      oauthConfigured: Boolean(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET),
    };
  }

  const row = result.rows[0];
  return {
    connected: true,
    id: row.id,
    teamName: row.team_name,
    channelName: row.channel_name,
    webhookConfigured: Boolean(row.webhook_url),
    oauthConfigured: Boolean(SLACK_CLIENT_ID && SLACK_CLIENT_SECRET),
    connectedAt: row.updated_at,
  };
}

export async function disconnectSlack() {
  await pool.query("UPDATE slack_integrations SET is_active = false");
  return { success: true };
}

export async function sendSlackRateLimitNotification(
  sender: string,
  limit: number,
  windowStart: string | Date
): Promise<boolean> {
  try {
    const status = await getSlackStatus();
    if (!status.connected) {
      console.log("[Slack] Notification skipped: Slack is not connected.");
      return false;
    }

    // Cooldown check via Redis to avoid spamming the same alert within 60s
    const cooldownKey = `slack:cooldown:${sender}:${new Date(windowStart).getTime()}`;
    const alreadyAlerted = await redisConnection.get(cooldownKey);
    if (alreadyAlerted) {
      return false;
    }

    const integrationResult = await pool.query(
      "SELECT webhook_url, access_token, channel_id FROM slack_integrations WHERE is_active = true ORDER BY id DESC LIMIT 1"
    );

    if (integrationResult.rows.length === 0) {
      return false;
    }

    const { webhook_url, access_token, channel_id } = integrationResult.rows[0];

    const message = {
      text: `⚠️ ReachInbox Alert: Hourly rate limit hit for sender ${sender}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 ReachInbox Rate Limit Reached",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Sender:*\n\`${sender}\``,
            },
            {
              type: "mrkdwn",
              text: `*Hourly Limit:*\n*${limit}* emails/hour`,
            },
            {
              type: "mrkdwn",
              text: `*Window Start:*\n${new Date(windowStart).toLocaleString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Status:*\n*Rescheduled automatically*`,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "ℹ️ *BullMQ Scheduler*: Exceeded jobs are automatically queued for the next hourly window without dropping or failing.",
            },
          ],
        },
      ],
    };

    if (webhook_url) {
      await axios.post(webhook_url, message);
    } else if (access_token && channel_id) {
      await axios.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: channel_id,
          ...message,
        },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Set cooldown in Redis for 5 minutes
    await redisConnection.set(cooldownKey, "1", "EX", 300);
    console.log(`[Slack] Live rate limit notification sent for sender ${sender}`);
    return true;
  } catch (error) {
    console.error("[Slack] Failed to send Slack notification:", (error as Error).message);
    return false;
  }
}

export async function sendTestSlackNotification(): Promise<boolean> {
  const status = await getSlackStatus();
  if (!status.connected) {
    throw new Error("Slack is not connected. Please connect Slack first.");
  }

  const integrationResult = await pool.query(
    "SELECT webhook_url, access_token, channel_id FROM slack_integrations WHERE is_active = true ORDER BY id DESC LIMIT 1"
  );
  const { webhook_url, access_token, channel_id } = integrationResult.rows[0];

  const payload = {
    text: "✅ ReachInbox Slack integration is connected and working!",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🚀 *ReachInbox Email Scheduler*: Slack notifications are successfully configured! Real-time alerts will trigger here whenever hourly rate limits are hit.",
        },
      },
    ],
  };

  if (webhook_url) {
    await axios.post(webhook_url, payload);
    return true;
  } else if (access_token && channel_id) {
    await axios.post("https://slack.com/api/chat.postMessage", { channel: channel_id, ...payload }, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    return true;
  }

  return false;
}
