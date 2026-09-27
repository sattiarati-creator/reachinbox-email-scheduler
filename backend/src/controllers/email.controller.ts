import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../db/pool";
import { emailQueue } from "../queues/email.queue";
import { indexEmail, searchEmails } from "../services/elasticsearch.service";
import { getCurrentRateLimit } from "../services/rateLimit.service";

export async function scheduleEmail(req: Request, res: Response) {
  try {
    const {
      sender = process.env.ETHEREAL_USER || "sender@example.com",
      recipient,
      recipients, // array of strings from CSV lead upload
      subject,
      body,
      scheduledAt,
      delaySeconds = 2, // stagger delay between leads in seconds
    } = req.body;

    if (!subject || !body || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "subject, body, and scheduledAt are required",
      });
    }

    // Determine target recipient list
    let targetRecipients: string[] = [];
    if (Array.isArray(recipients) && recipients.length > 0) {
      targetRecipients = recipients.map((r: string) => r.trim()).filter(Boolean);
    } else if (recipient && typeof recipient === "string" && recipient.trim()) {
      targetRecipients = [recipient.trim()];
    }

    if (targetRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid recipient email is required",
      });
    }

    const baseScheduledTime = new Date(scheduledAt);
    if (Number.isNaN(baseScheduledTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduledAt date format",
      });
    }

    const now = Date.now();
    const scheduledRecords: any[] = [];
    const stepDelayMs = Math.max(0, Number(delaySeconds) * 1000);

    for (let i = 0; i < targetRecipients.length; i++) {
      const emailRecipient = targetRecipients[i];
      const targetTime = new Date(baseScheduledTime.getTime() + i * stepDelayMs);
      const delay = Math.max(0, targetTime.getTime() - now);
      const id = crypto.randomUUID();
      const jobId = `email-${id}`;

      const result = await pool.query(
        `
        INSERT INTO emails (
          id,
          sender,
          recipient,
          subject,
          body,
          scheduled_at,
          status,
          job_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
        RETURNING *
        `,
        [id, sender, emailRecipient, subject, body, targetTime, jobId]
      );

      const savedEmail = result.rows[0];

      // Add delayed job to BullMQ
      await emailQueue.add(
        "send-email",
        { emailId: id },
        {
          jobId,
          delay,
          removeOnComplete: false,
          removeOnFail: false,
        }
      );

      // Index into Elasticsearch
      await indexEmail(savedEmail);

      scheduledRecords.push(savedEmail);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully scheduled ${scheduledRecords.length} email(s)`,
      count: scheduledRecords.length,
      emails: scheduledRecords,
    });
  } catch (error: any) {
    console.error("[Email Controller] Schedule email error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to schedule email",
      error: error.message,
    });
  }
}

export async function getScheduledEmails(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.q as string || "").trim();

    if (search) {
      const result = await searchEmails({ query: search, status: "scheduled", limit, offset });
      return res.json({
        success: true,
        data: result.emails,
        total: result.total,
        page,
        limit,
        source: result.source,
      });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM emails WHERE status IN ('scheduled', 'delayed')`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const rowsResult = await pool.query(
      `
      SELECT * FROM emails
      WHERE status IN ('scheduled', 'delayed')
      ORDER BY scheduled_at ASC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return res.json({
      success: true,
      data: rowsResult.rows,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[Email Controller] Get scheduled emails error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getSentEmails(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.q as string || "").trim();

    if (search) {
      const result = await searchEmails({ query: search, status: "sent", limit, offset });
      return res.json({
        success: true,
        data: result.emails,
        total: result.total,
        page,
        limit,
        source: result.source,
      });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM emails WHERE status IN ('sent', 'failed')`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const rowsResult = await pool.query(
      `
      SELECT * FROM emails
      WHERE status IN ('sent', 'failed')
      ORDER BY sent_at DESC NULLS LAST, updated_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return res.json({
      success: true,
      data: rowsResult.rows,
      total,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[Email Controller] Get sent emails error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function searchAllEmails(req: Request, res: Response) {
  try {
    const query = (req.query.q as string || "").trim();
    const status = (req.query.status as string || "").trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const result = await searchEmails({
      query,
      status: status || undefined,
      limit,
      offset,
    });

    return res.json({
      success: true,
      ...result,
      page,
      limit,
    });
  } catch (error: any) {
    console.error("[Email Controller] Search error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const sender = (req.query.sender as string) || "default";

    const counts = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'scheduled' OR status = 'delayed') AS scheduled_count,
        COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
        COUNT(*) AS total_count
      FROM emails
    `);

    const rateLimit = await getCurrentRateLimit(sender);

    return res.json({
      success: true,
      stats: {
        scheduled: parseInt(counts.rows[0].scheduled_count || "0", 10),
        sent: parseInt(counts.rows[0].sent_count || "0", 10),
        failed: parseInt(counts.rows[0].failed_count || "0", 10),
        total: parseInt(counts.rows[0].total_count || "0", 10),
      },
      rateLimit,
      config: {
        workerConcurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
        emailDelayMs: Number(process.env.EMAIL_DELAY_MS) || 2000,
        maxEmailsPerHour: Number(process.env.MAX_EMAILS_PER_HOUR) || 100,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function cancelEmail(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM emails WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const email = result.rows[0];
    if (email.status === "sent") {
      return res.status(400).json({ success: false, message: "Cannot cancel already sent email" });
    }

    const jobId = email.job_id || `email-${id}`;
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }

    const updated = await pool.query(
      `UPDATE emails SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    await indexEmail(updated.rows[0]);

    return res.json({
      success: true,
      message: "Email scheduling cancelled successfully",
      email: updated.rows[0],
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}