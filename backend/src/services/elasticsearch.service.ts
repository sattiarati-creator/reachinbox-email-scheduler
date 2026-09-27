import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
import { pool } from "../db/pool";

dotenv.config();

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || "http://localhost:9200";
export const esClient = new Client({ node: ELASTICSEARCH_URL });

export const EMAILS_INDEX = "emails";

let isEsConnected = false;

export async function initElasticsearch(): Promise<boolean> {
  try {
    const health = await esClient.cluster.health({});
    isEsConnected = health.status !== "red";
    console.log(`[Elasticsearch] Connected successfully. Cluster status: ${health.status}`);

    const indexExists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        settings: {
          analysis: {
            analyzer: {
              email_analyzer: {
                type: "custom",
                tokenizer: "uax_url_email",
                filter: ["lowercase"],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: "keyword" },
            sender: { type: "text", fields: { keyword: { type: "keyword" } } },
            recipient: { type: "text", fields: { keyword: { type: "keyword" } }, analyzer: "email_analyzer" },
            subject: { type: "text" },
            body: { type: "text" },
            status: { type: "keyword" },
            scheduled_at: { type: "date" },
            sent_at: { type: "date" },
            preview_url: { type: "keyword" },
            error_message: { type: "text" },
            created_at: { type: "date" },
          },
        },
      });
      console.log(`[Elasticsearch] Created index: ${EMAILS_INDEX}`);

      // Sync existing emails from PostgreSQL
      await syncAllEmailsToElasticsearch();
    }

    return true;
  } catch (error) {
    console.warn("[Elasticsearch] Connection warning. Continuing with PostgreSQL fallback:", (error as Error).message);
    isEsConnected = false;
    return false;
  }
}

export async function indexEmail(email: {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduled_at: Date | string;
  sent_at?: Date | string | null;
  preview_url?: string | null;
  error_message?: string | null;
  created_at?: Date | string;
}): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        sender: email.sender,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduled_at: email.scheduled_at,
        sent_at: email.sent_at || null,
        preview_url: email.preview_url || null,
        error_message: email.error_message || null,
        created_at: email.created_at || new Date(),
      },
      refresh: "wait_for",
    });
  } catch (err) {
    console.warn(`[Elasticsearch] Failed to index email ${email.id}:`, (err as Error).message);
  }
}

export async function syncAllEmailsToElasticsearch(): Promise<void> {
  try {
    const result = await pool.query("SELECT * FROM emails");
    if (result.rows.length === 0) return;

    for (const email of result.rows) {
      await indexEmail(email);
    }
    console.log(`[Elasticsearch] Synced ${result.rows.length} existing emails to ${EMAILS_INDEX}`);
  } catch (err) {
    console.warn("[Elasticsearch] Error syncing emails:", (err as Error).message);
  }
}

export interface SearchOptions {
  query?: string;
  status?: string; // 'scheduled' | 'sent' | 'failed'
  limit?: number;
  offset?: number;
}

export async function searchEmails(options: SearchOptions) {
  const { query = "", status, limit = 50, offset = 0 } = options;

  // Try Elasticsearch search first
  try {
    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    if (query.trim()) {
      const cleanQ = query.trim().replace(/[*?+\-&|!(){}[\]^"~:\\]/g, "\\$&");
      mustClauses.push({
        bool: {
          should: [
            {
              multi_match: {
                query: query.trim(),
                fields: ["recipient^3", "subject^2", "body", "sender"],
                fuzziness: "AUTO",
              },
            },
            {
              query_string: {
                query: `*${cleanQ}*`,
                fields: ["recipient", "sender", "subject", "body"],
                analyze_wildcard: true,
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    if (status) {
      filterClauses.push({
        term: { status },
      });
    }

    const response = await esClient.search({
      index: EMAILS_INDEX,
      from: offset,
      size: limit,
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses,
        },
      },
      sort: [
        { created_at: { order: "desc" } }
      ],
    });

    const total = typeof response.hits.total === "number" ? response.hits.total : response.hits.total?.value || 0;
    const emails = response.hits.hits.map((hit) => hit._source);

    return {
      source: "elasticsearch",
      total,
      emails,
    };
  } catch (esError) {
    console.warn("[Elasticsearch] Search query failed, falling back to PostgreSQL:", (esError as Error).message);
    return searchEmailsInPostgres(options);
  }
}

async function searchEmailsInPostgres(options: SearchOptions) {
  const { query = "", status, limit = 50, offset = 0 } = options;
  const values: any[] = [];
  const conditions: string[] = [];

  if (query.trim()) {
    values.push(`%${query.trim()}%`);
    const idx = values.length;
    conditions.push(`(recipient ILIKE $${idx} OR subject ILIKE $${idx} OR body ILIKE $${idx} OR sender ILIKE $${idx})`);
  }

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(limit);
  const limitIdx = values.length;
  values.push(offset);
  const offsetIdx = values.length;

  const countResult = await pool.query(`SELECT COUNT(*) FROM emails ${whereClause}`, values.slice(0, values.length - 2));
  const emailsResult = await pool.query(
    `SELECT * FROM emails ${whereClause} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  return {
    source: "postgresql_fallback",
    total: parseInt(countResult.rows[0].count, 10),
    emails: emailsResult.rows,
  };
}
