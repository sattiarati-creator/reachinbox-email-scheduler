import { Request, Response } from "express";
import { pool } from "../db/pool";

export async function syncGoogleUser(req: Request, res: Response) {
  try {
    const { email, name, avatarUrl, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO users (email, name, avatar_url, google_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email)
      DO UPDATE SET
        name = COALESCE(EXCLUDED.name, users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        google_id = COALESCE(EXCLUDED.google_id, users.google_id),
        updated_at = NOW()
      RETURNING *
      `,
      [email, name, avatarUrl, googleId]
    );

    return res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (err: any) {
    console.error("[Auth] User sync error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
