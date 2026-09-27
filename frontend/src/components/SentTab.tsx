import React from "react";
import type { Email } from "../types";
import { CheckCircle2, AlertCircle, ExternalLink, Search, RefreshCw, Send, Calendar } from "lucide-react";

interface SentTabProps {
  emails: Email[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
}

export const SentTab: React.FC<SentTabProps> = ({
  emails,
  isLoading,
  searchQuery,
  onSearchChange,
  onRefresh,
}) => {
  const formatSentTime = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-surface-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search sent emails (Elasticsearch)..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-surface-card border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-surface-muted hover:text-white bg-surface-card hover:bg-surface-hover border border-surface-border rounded-xl transition-colors self-end sm:self-auto"
          title="Refresh sent emails list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-brand-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-surface-muted">Loading sent emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto text-surface-muted border border-surface-border">
              <Send className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No sent emails recorded</h3>
              <p className="text-xs text-surface-muted mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No sent emails matching "${searchQuery}".`
                  : "Scheduled emails will automatically appear here once dispatched by the BullMQ worker."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-bg/40 text-[11px] font-semibold text-surface-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Sent Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ethereal Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {emails.map((email) => {
                  const isSent = email.status === "sent";

                  return (
                    <tr
                      key={email.id}
                      className="hover:bg-surface-hover/50 transition-colors group"
                    >
                      <td className="py-3 px-4 font-medium text-white max-w-[200px] truncate">
                        {email.recipient}
                      </td>
                      <td className="py-3 px-4 text-gray-300 max-w-[250px] truncate">
                        {email.subject}
                      </td>
                      <td className="py-3 px-4 text-surface-muted max-w-[160px] truncate">
                        {email.sender}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-gray-300">
                          <Calendar className="w-3.5 h-3.5 text-surface-muted" />
                          <span>{formatSentTime(email.sent_at)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            isSent
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {isSent ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                              <span>Delivered</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 mr-1 text-rose-400" />
                              <span>Failed</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {email.preview_url ? (
                          <a
                            href={email.preview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 rounded-lg transition-colors"
                            title="View fake email rendered on Ethereal"
                          >
                            <span>View Email</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-surface-muted italic">
                            {email.error_message ? "Failed send" : "Local SMTP"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
