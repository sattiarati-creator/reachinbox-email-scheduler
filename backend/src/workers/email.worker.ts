import { Worker, DelayedError } from "bullmq";
import dotenv from "dotenv";
import nodemailer, { Transporter } from "nodemailer";
import { redisConnection } from "../config/redis";
import { pool } from "../db/pool";
import { tryReserveEmailSlot, releaseEmailSlot } from "../services/rateLimit.service";
import { sendSlackRateLimitNotification } from "../services/slack.service";
import { indexEmail } from "../services/elasticsearch.service";

dotenv.config();

const EMAIL_DELAY_MS = Number(process.env.EMAIL_DELAY_MS) || 2000;
const MAX_EMAILS_PER_HOUR = Number(process.env.MAX_EMAILS_PER_HOUR) || 100;
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 5;

let transporter: Transporter;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.ETHEREAL_HOST || "smtp.ethereal.email",
      port: Number(process.env.ETHEREAL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });
  } else {
    console.log("[Worker] Creating test Ethereal account...");
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[Worker] Generated Ethereal User: ${testAccount.user}`);
  }
  return transporter;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ensures minimum delay between email sends across all concurrent workers.
 * Uses atomic Redis keys for cross-process synchronization.
 */
async function waitForGlobalSendSlot(sender = "global") {
  const lockKey = `email-scheduler:last-send-time:${sender}`;

  while (true) {
    const now = Date.now();
    const lastSendTime = await redisConnection.get(lockKey);

    if (!lastSendTime) {
      const acquired = await redisConnection.set(lockKey, String(now), "NX");
      if (acquired) return;
      continue;
    }

    const elapsed = now - Number(lastSendTime);
    const remaining = EMAIL_DELAY_MS - elapsed;

    if (remaining <= 0) {
      const acquired = await redisConnection.set(lockKey, String(now), "XX");
      if (acquired) return;
      continue;
    }

    await sleep(remaining);
  }
}

function getMillisecondsUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  return nextHour.getTime() - now.getTime();
}

export const emailWorker = new Worker(
  "email-queue",
  async (job, token) => {
    const { emailId } = job.data;
    console.log(`\n[Worker] Processing email job: ${job.id} (Email ID: ${emailId})`);

    // 1. Fetch email from DB
    const result = await pool.query(
      `SELECT * FROM emails WHERE id = $1`,
      [emailId]
    );

    if (result.rowCount === 0) {
      console.warn(`[Worker] Email not found: ${emailId}`);
      return { success: false, message: "Email not found" };
    }

    const email = result.rows[0];

    // 2. Prevent duplicate sending (idempotency check)
    if (email.status === "sent") {
      console.log(`[Worker] Email ${emailId} is already marked as 'sent'. Skipping.`);
      return { success: true, emailId, skipped: true };
    }

    // 3. Atomically reserve hourly rate-limit slot (per sender)
    const slotReserved = await tryReserveEmailSlot(email.sender);

    if (!slotReserved) {
      const delayUntilNextHour = getMillisecondsUntilNextHour();
      console.warn(
        `[Worker] ⚠️ Hourly rate limit (${MAX_EMAILS_PER_HOUR}/hr) reached for sender '${email.sender}'. Delaying job by ${Math.ceil(
          delayUntilNextHour / 1000
        )}s.`
      );

      // Trigger real Slack notification immediately (if connected)
      await sendSlackRateLimitNotification(
        email.sender,
        MAX_EMAILS_PER_HOUR,
        new Date()
      );

      // Update email status to 'delayed'
      await pool.query(
        `UPDATE emails SET status = 'delayed', updated_at = NOW() WHERE id = $1`,
        [emailId]
      );

      // Reschedule job into next hourly window without dropping
      await job.moveToDelayed(Date.now() + delayUntilNextHour, token);
      throw new DelayedError();
    }

    let emailSent = false;

    try {
      // 4. Enforce minimum delay between emails (provider throttling emulation)
      await waitForGlobalSendSlot(email.sender);

      console.log(`[Worker] 📤 Sending email to ${email.recipient} via Ethereal SMTP...`);
      const mailTransporter = await getTransporter();

      const info = await mailTransporter.sendMail({
        from: email.sender,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        html: `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">${email.body.replace(/\n/g, "<br/>")}</div>`,
      });

      emailSent = true;
      const previewUrl = nodemailer.getTestMessageUrl(info) || "";

      console.log(`[Worker] ✅ Email sent to ${email.recipient}!`);
      console.log(`[Worker] Message ID: ${info.messageId}`);
      if (previewUrl) {
        console.log(`[Worker] 🔗 Ethereal Preview URL: ${previewUrl}`);
      }

      // 5. Update database status to 'sent'
      const updatedResult = await pool.query(
        `
        UPDATE emails
        SET
          status = 'sent',
          sent_at = NOW(),
          preview_url = $2,
          attempts = attempts + 1,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [emailId, previewUrl]
      );

      const updatedEmail = updatedResult.rows[0];

      // 6. Index into Elasticsearch
      await indexEmail(updatedEmail);

      return {
        success: true,
        emailId,
        messageId: info.messageId,
        previewUrl,
      };
    } catch (error: any) {
      console.error(`[Worker] ❌ Failed to send email ${emailId}:`, error.message);

      // Release reserved slot if send failed
      if (!emailSent) {
        await releaseEmailSlot(email.sender);
      }

      const nextAttempts = (email.attempts || 0) + 1;
      const isFinalFailure = nextAttempts >= 3;
      const nextStatus = isFinalFailure ? "failed" : "scheduled";

      const errResult = await pool.query(
        `
        UPDATE emails
        SET
          status = $2,
          attempts = $3,
          error_message = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [emailId, nextStatus, nextAttempts, error.message]
      );

      if (errResult.rows[0]) {
        await indexEmail(errResult.rows[0]);
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: WORKER_CONCURRENCY,
  }
);

emailWorker.on("completed", (job) => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

emailWorker.on("failed", (job, error) => {
  console.error(`[Worker] Job failed: ${job?.id} - Reason: ${error.message}`);
});

console.log(`\n========================================`);
console.log(` ReachInbox Email Worker Initialized`);
console.log(` Concurrency: ${WORKER_CONCURRENCY}`);
console.log(` Delay between sends: ${EMAIL_DELAY_MS}ms`);
console.log(` Max emails / hour: ${MAX_EMAILS_PER_HOUR}`);
console.log(`========================================\n`);