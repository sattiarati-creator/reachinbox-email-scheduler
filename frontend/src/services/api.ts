import axios from "axios";
import type { Email, ScheduleEmailPayload, SlackStatus, StatsResponse, User } from "../types";

const API_BASE = "/api";

export const api = {
  // Stats
  async getStats(sender?: string): Promise<StatsResponse> {
    const res = await axios.get(`${API_BASE}/emails/stats`, {
      params: { sender },
    });
    return res.data;
  },

  // Scheduled Emails
  async getScheduledEmails(
    page = 1,
    limit = 20,
    q = ""
  ): Promise<{ data: Email[]; total: number; source?: string }> {
    const res = await axios.get(`${API_BASE}/emails/scheduled`, {
      params: { page, limit, q },
    });
    return res.data;
  },

  // Sent Emails
  async getSentEmails(
    page = 1,
    limit = 20,
    q = ""
  ): Promise<{ data: Email[]; total: number; source?: string }> {
    const res = await axios.get(`${API_BASE}/emails/sent`, {
      params: { page, limit, q },
    });
    return res.data;
  },

  // Schedule Emails
  async scheduleEmails(payload: ScheduleEmailPayload): Promise<any> {
    const res = await axios.post(`${API_BASE}/emails/schedule`, payload);
    return res.data;
  },

  // Cancel Email
  async cancelEmail(id: string): Promise<any> {
    const res = await axios.post(`${API_BASE}/emails/cancel/${id}`);
    return res.data;
  },

  // Slack Integration
  async getSlackStatus(): Promise<SlackStatus> {
    const res = await axios.get(`${API_BASE}/slack/status`);
    return res.data;
  },

  async getSlackOAuthUrl(): Promise<string> {
    const res = await axios.get(`${API_BASE}/slack/oauth/url`);
    return res.data.url;
  },

  async connectSlackWebhook(webhookUrl: string, channelName = "General"): Promise<any> {
    const res = await axios.post(`${API_BASE}/slack/webhook`, { webhookUrl, channelName });
    return res.data;
  },

  async disconnectSlack(): Promise<any> {
    const res = await axios.post(`${API_BASE}/slack/disconnect`);
    return res.data;
  },

  async testSlackNotification(): Promise<any> {
    const res = await axios.post(`${API_BASE}/slack/test`);
    return res.data;
  },

  async sendSlackTestNotification(): Promise<any> {
    return this.testSlackNotification();
  },

  // Auth / Google User Sync
  async syncUser(user: Partial<User> & { googleId?: string }): Promise<any> {
    const res = await axios.post(`${API_BASE}/auth/google`, user);
    return res.data;
  },
};
