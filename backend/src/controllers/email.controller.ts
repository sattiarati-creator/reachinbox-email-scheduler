import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../db/pool";
import { emailQueue } from "../queues/email.queue";

export async function scheduleEmail(req: Request, res: Response) {
  try {
    const {
      sender,
      recipient,
      subject,
      body,
      scheduledAt,
    } = req.body;

    if (!sender || !recipient || !subject || !body || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message:
          "sender, recipient, subject, body and scheduledAt are required",
      });
    }

    const scheduledTime = new Date(scheduledAt);
    const delay = scheduledTime.getTime() - Date.now();

    if (Number.isNaN(scheduledTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduledAt date",
      });
    }

    if (delay < 0) {
      return res.status(400).json({
        success: false,
        message: "scheduledAt must be in the future",
      });
    }

    const id = crypto.randomUUID();

    const result = await pool.query(
      `
      INSERT INTO emails (
        id,
        sender,
        recipient,
        subject,
        body,
        scheduled_at,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
      RETURNING *
      `,
      [
        id,
        sender,
        recipient,
        subject,
        body,
        scheduledAt,
      ]
    );

    await emailQueue.add(
      "send-email",
      {
        emailId: id,
      },
      {
        jobId: `email-${id}`,
        delay,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Email scheduled successfully",
      email: result.rows[0],
    });
  } catch (error) {
    console.error("Schedule email error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to schedule email",
    });
  }
}