import { pool } from "../db/pool";

export const MAX_EMAILS_PER_HOUR =
  Number(process.env.MAX_EMAILS_PER_HOUR) || 100;

export async function tryReserveEmailSlot(sender = "default"): Promise<boolean> {
  const result = await pool.query(
    `
    INSERT INTO email_rate_limits (
      sender,
      window_start,
      email_count
    )
    VALUES (
      $1,
      date_trunc('hour', NOW()),
      1
    )
    ON CONFLICT (sender, window_start)
    DO UPDATE SET
      email_count = email_rate_limits.email_count + 1,
      updated_at = NOW()
    WHERE email_rate_limits.email_count < $2
    RETURNING email_count
    `,
    [sender, MAX_EMAILS_PER_HOUR]
  );

  return result.rowCount !== 0;
}

export async function releaseEmailSlot(sender = "default"): Promise<void> {
  await pool.query(
    `
    UPDATE email_rate_limits
    SET
      email_count = GREATEST(email_count - 1, 0),
      updated_at = NOW()
    WHERE sender = $1 AND window_start = date_trunc('hour', NOW())
    `,
    [sender]
  );
}

export async function getCurrentRateLimit(sender = "default") {
  const result = await pool.query(
    `
    SELECT
      sender,
      window_start,
      email_count
    FROM email_rate_limits
    WHERE sender = $1 AND window_start = date_trunc('hour', NOW())
    `,
    [sender]
  );

  const emailCount =
    result.rowCount === 0
      ? 0
      : result.rows[0].email_count;

  return {
    sender,
    windowStart:
      result.rowCount === 0
        ? null
        : result.rows[0].window_start,
    emailCount,
    limit: MAX_EMAILS_PER_HOUR,
    remaining: Math.max(
      MAX_EMAILS_PER_HOUR - emailCount,
      0
    ),
  };
}