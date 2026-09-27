import dotenv from "dotenv";
import { pool } from "./pool";

dotenv.config();

export async function initDatabase() {
  // Emails table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY,
      sender VARCHAR(255) NOT NULL,
      recipient VARCHAR(255) NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at TIMESTAMP NOT NULL,
      sent_at TIMESTAMP NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
      attempts INTEGER NOT NULL DEFAULT 0,
      job_id VARCHAR(255) UNIQUE,
      preview_url TEXT,
      error_message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Ensure new columns exist if table was already created
  await pool.query(`
    ALTER TABLE emails ADD COLUMN IF NOT EXISTS preview_url TEXT;
    ALTER TABLE emails ADD COLUMN IF NOT EXISTS error_message TEXT;
  `);

  // Email rate limits table (per sender & hourly window)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_rate_limits (
      id SERIAL PRIMARY KEY,
      sender VARCHAR(255) NOT NULL DEFAULT 'default',
      window_start TIMESTAMP NOT NULL,
      email_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Add sender column if not present in email_rate_limits
  await pool.query(`
    ALTER TABLE email_rate_limits ADD COLUMN IF NOT EXISTS sender VARCHAR(255) NOT NULL DEFAULT 'default';
  `);

  // Ensure unique constraint on (sender, window_start)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_rate_limits_sender_window_key'
      ) THEN
        -- Remove old constraint if existed
        ALTER TABLE email_rate_limits DROP CONSTRAINT IF EXISTS email_rate_limits_window_start_key;
        ALTER TABLE email_rate_limits ADD CONSTRAINT email_rate_limits_sender_window_key UNIQUE (sender, window_start);
      END IF;
    END $$;
  `);

  // Slack integrations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS slack_integrations (
      id SERIAL PRIMARY KEY,
      team_id VARCHAR(255),
      team_name VARCHAR(255),
      channel_id VARCHAR(255),
      channel_name VARCHAR(255),
      access_token TEXT,
      webhook_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Users table for Google login
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      avatar_url TEXT,
      google_id VARCHAR(255) UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Database schema initialized and verified successfully");
}

if (require.main === module) {
  initDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch((error) => {
      console.error("Database initialization failed:", error);
      process.exit(1);
    });
}