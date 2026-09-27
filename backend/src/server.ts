import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import emailRoutes from "./routes/email.routes";
import slackRoutes from "./routes/slack.routes";
import authRoutes from "./routes/auth.routes";
import { emailQueue, recoverScheduledEmails } from "./queues/email.queue";
import { initElasticsearch } from "./services/elasticsearch.service";
import { initDatabase } from "./db/init";

// Also import worker if running unified or alongside
import "./workers/email.worker";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Set up Bull-Board UI for real-time queue visibility
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

// Application API routes
app.use("/api/emails", emailRoutes);
app.use("/api/slack", slackRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/health", async (_req, res) => {
  const counts = await emailQueue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed"
  );

  res.json({
    success: true,
    message: "ReachInbox Email Scheduler API is running smoothly",
    timestamp: new Date().toISOString(),
    queue: {
      name: "email-queue",
      jobCounts: counts,
    },
    bullBoardUrl: "http://localhost:5000/admin/queues",
  });
});

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  try {
    // 1. Initialize DB schema if needed
    await initDatabase();

    // 2. Initialize Elasticsearch index and mapping
    await initElasticsearch();

    // 3. Recover scheduled emails from DB into BullMQ (persistence on restart)
    await recoverScheduledEmails();

    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 ReachInbox Scheduler API is running!`);
      console.log(`📍 API Server:        http://localhost:${PORT}`);
      console.log(`📊 BullMQ Dashboard:  http://localhost:${PORT}/admin/queues`);
      console.log(`🩺 Health Endpoint:   http://localhost:${PORT}/api/health`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

bootstrap();