import React from "react";
import type { StatsResponse } from "../types";
import { Clock, Send, Zap, Activity } from "lucide-react";

interface StatsBarProps {
  statsData: StatsResponse | null;
}

export const StatsBar: React.FC<StatsBarProps> = ({ statsData }) => {
  const stats = statsData?.stats || { scheduled: 0, sent: 0, failed: 0, total: 0 };
  const rateLimit = statsData?.rateLimit || {
    emailCount: 0,
    limit: 100,
    remaining: 100,
  };
  const config = statsData?.config || {
    workerConcurrency: 5,
    emailDelayMs: 2000,
  };

  const usagePercent = Math.min(
    100,
    Math.round((rateLimit.emailCount / Math.max(1, rateLimit.limit)) * 100)
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Scheduled Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-surface-muted">Scheduled Emails</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{stats.scheduled}</p>
          <p className="text-[11px] text-surface-muted mt-0.5">Pending in queue</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Sent Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-surface-muted">Sent Emails</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.sent}</p>
          <p className="text-[11px] text-surface-muted mt-0.5">Delivered via Ethereal</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Send className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      {/* Rate Limit Hourly Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-surface-muted">Hourly Rate Limit</p>
          <div className="w-7 h-7 rounded bg-brand-500/10 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-brand-400" />
          </div>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-2xl font-bold text-white">
            {rateLimit.emailCount} <span className="text-sm font-normal text-surface-muted">/ {rateLimit.limit}</span>
          </span>
          <span className={`text-xs font-medium ${usagePercent > 80 ? 'text-rose-400' : 'text-brand-300'}`}>
            {rateLimit.remaining} left
          </span>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-surface-hover h-1.5 rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              usagePercent > 90 ? 'bg-rose-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-brand-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>

      {/* Worker Specs Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-xs font-medium text-surface-muted">Engine Parameters</p>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-sm font-semibold text-white">
              {config.workerConcurrency} Workers
            </span>
            <span className="text-xs text-surface-muted">|</span>
            <span className="text-sm font-semibold text-brand-300">
              {config.emailDelayMs / 1000}s Delay
            </span>
          </div>
          <p className="text-[11px] text-surface-muted mt-0.5">BullMQ Persistent Queue</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-indigo-400" />
        </div>
      </div>
    </div>
  );
};
