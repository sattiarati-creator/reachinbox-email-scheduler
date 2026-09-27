import dotenv from "dotenv";
import { pool } from "./pool";

dotenv.config();

async function initDatabase() {
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

      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  console.log("Database initialized successfully");

  await pool.end();
}

initDatabase().catch((error) => {
  console.error("Database initialization failed:", error);
  process.exit(1);
});