import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import { pool } from "../db/pool";

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
});

/**
 * Recovers scheduled emails from the database on server startup.
 * Ensures future emails still send at the correct time even after server or Redis restart.
 */
export async function recoverScheduledEmails() {
  try {
    const result = await pool.query(
      `SELECT * FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`
    );

    let recoveredCount = 0;
    const now = Date.now();

    for (const email of result.rows) {
      const jobId = email.job_id || `email-${email.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      if (!existingJob) {
        const scheduledTime = new Date(email.scheduled_at).getTime();
        const delay = Math.max(0, scheduledTime - now);

        await emailQueue.add(
          "send-email",
          { emailId: email.id },
          {
            jobId,
            delay,
            removeOnComplete: false,
            removeOnFail: false,
          }
        );

        recoveredCount++;
      }
    }

    if (recoveredCount > 0) {
      console.log(`[Queue Recovery] Recovered and synchronized ${recoveredCount} scheduled emails into BullMQ.`);
    }
  } catch (err) {
    console.error("[Queue Recovery] Failed to recover scheduled emails:", err);
  }
}