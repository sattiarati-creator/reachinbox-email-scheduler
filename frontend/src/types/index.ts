export interface Email {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at?: string | null;
  status: 'scheduled' | 'delayed' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  job_id?: string;
  preview_url?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface RateLimitInfo {
  sender: string;
  windowStart: string | null;
  emailCount: number;
  limit: number;
  remaining: number;
}

export interface StatsResponse {
  success: boolean;
  stats: EmailStats;
  rateLimit: RateLimitInfo;
  config: {
    workerConcurrency: number;
    emailDelayMs: number;
    maxEmailsPerHour: number;
  };
}

export interface SlackStatus {
  connected: boolean;
  id?: number;
  teamName?: string;
  channelName?: string;
  webhookConfigured?: boolean;
  oauthConfigured?: boolean;
  connectedAt?: string;
}

export interface User {
  name: string;
  email: string;
  avatarUrl: string;
}

export interface ScheduleEmailPayload {
  sender: string;
  recipient?: string;
  recipients?: string[];
  subject: string;
  body: string;
  scheduledAt: string;
  delaySeconds: number;
  hourlyLimit?: number;
}
