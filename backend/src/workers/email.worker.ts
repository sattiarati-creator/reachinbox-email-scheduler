import { Worker } from "bullmq";
import dotenv from "dotenv";
import { redisConnection } from "../config/redis";
import { pool } from "../db/pool";

dotenv.config();

const worker = new Worker(
  "email-queue",
  async (job) => {
    const { emailId } = job.data;

    console.log(`Processing email job: ${job.id}`);
    console.log(`Email ID: ${emailId}`);

    const result = await pool.query(
      `
      UPDATE emails
      SET
        status = 'sent',
        sent_at = NOW(),
        updated_at = NOW(),
        attempts = attempts + 1
      WHERE id = $1
      RETURNING *
      `,
      [emailId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Email not found: ${emailId}`);
    }

    console.log(`Email ${emailId} marked as sent`);

    return {
      success: true,
      emailId,
    };
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
  }
);

worker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Job failed: ${job?.id}`, error);
});

console.log("Email worker started");