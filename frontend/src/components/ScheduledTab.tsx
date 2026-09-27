import React from "react";
import type { Email } from "../types";
import { Search, RefreshCw, Trash2, Calendar, Inbox } from "lucide-react";

interface ScheduledTabProps {
  emails: Email[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onCancelEmail: (id: string) => void;
  onComposeClick: () => void;
}

export const ScheduledTab: React.FC<ScheduledTabProps> = ({
  emails,
  isLoading,
  searchQuery,
  onSearchChange,
  onRefresh,
  onCancelEmail,
  onComposeClick,
}) => {
  const formatScheduledTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return {
        formatted: date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        isPast: date.getTime() < Date.now(),
      };
    } catch {
      return { formatted: dateStr, isPast: false };
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
            placeholder="Search scheduled emails (Elasticsearch)..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-surface-card border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-surface-muted hover:text-white bg-surface-card hover:bg-surface-hover border border-surface-border rounded-xl transition-colors self-end sm:self-auto"
          title="Refresh queue status"
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
            <p className="text-xs text-surface-muted">Loading scheduled emails from queue...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto text-surface-muted border border-surface-border">
              <Inbox className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No scheduled emails found</h3>
              <p className="text-xs text-surface-muted mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No results matching "${searchQuery}". Try a different keyword.`
                  : "Your BullMQ queue is currently clear. Schedule a new email or upload lead sequence to start."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={onComposeClick}
                className="px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-all shadow-md shadow-brand-500/20"
              >
                + Schedule Your First Email
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-bg/40 text-[11px] font-semibold text-surface-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Scheduled Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {emails.map((email) => {
                  const timeInfo = formatScheduledTime(email.scheduled_at);
                  const isDelayed = email.status === "delayed";

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
                          <Calendar className="w-3.5 h-3.5 text-brand-400" />
                          <span>{timeInfo.formatted}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            isDelayed
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isDelayed ? "bg-purple-400" : "bg-amber-400 animate-pulse"
                            }`}
                          />
                          {isDelayed ? "Delayed (Rate Limit)" : "Scheduled"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onCancelEmail(email.id)}
                          className="p-1 text-surface-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Cancel scheduled email"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
