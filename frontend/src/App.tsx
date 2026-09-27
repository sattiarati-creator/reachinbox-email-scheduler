import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider } from "./context/AuthContext";
import { Header } from "./components/Header";
import { StatsBar } from "./components/StatsBar";
import { ScheduledTab } from "./components/ScheduledTab";
import { SentTab } from "./components/SentTab";
import { ComposeModal } from "./components/ComposeModal";
import { SlackModal } from "./components/SlackModal";
import { GoogleAuthModal } from "./components/GoogleAuthModal";
import { api } from "./services/api";
import type { Email, SlackStatus, StatsResponse } from "./types";
import { Calendar, Send, Plus, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

const MainDashboard: React.FC = () => {

  // Tab State
  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">("scheduled");

  // Email State
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [scheduledSearch, setScheduledSearch] = useState("");
  const [sentSearch, setSentSearch] = useState("");

  // Loading States
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [isLoadingSent, setIsLoadingSent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Stats & Slack
  const [statsData, setStatsData] = useState<StatsResponse | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Toast / Banner notification
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStatsData(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  // Fetch Slack Status
  const fetchSlackStatus = useCallback(async () => {
    try {
      const status = await api.getSlackStatus();
      setSlackStatus(status);
    } catch (err) {
      console.error("Failed to fetch Slack status:", err);
    }
  }, []);

  // Fetch Scheduled Emails
  const fetchScheduledEmails = useCallback(async (query = scheduledSearch) => {
    setIsLoadingScheduled(true);
    try {
      const res = await api.getScheduledEmails(1, 100, query);
      setScheduledEmails(res.data || []);
    } catch (err: any) {
      console.error("Failed to fetch scheduled emails:", err);
    } finally {
      setIsLoadingScheduled(false);
    }
  }, [scheduledSearch]);

  // Fetch Sent Emails
  const fetchSentEmails = useCallback(async (query = sentSearch) => {
    setIsLoadingSent(true);
    try {
      const res = await api.getSentEmails(1, 100, query);
      setSentEmails(res.data || []);
    } catch (err: any) {
      console.error("Failed to fetch sent emails:", err);
    } finally {
      setIsLoadingSent(false);
    }
  }, [sentSearch]);

  // Unified Refresh
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchStats(),
      fetchSlackStatus(),
      fetchScheduledEmails(),
      fetchSentEmails(),
    ]);
    setIsRefreshing(false);
  };

  // Initial load
  useEffect(() => {
    handleRefreshAll();
  }, []);

  // Polling every 5 seconds to keep queue status in sync
  useEffect(() => {
    const timer = setInterval(() => {
      fetchStats();
      if (activeTab === "scheduled") {
        fetchScheduledEmails();
      } else {
        fetchSentEmails();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeTab, fetchStats, fetchScheduledEmails, fetchSentEmails]);

  // Handle Search Input with Debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchScheduledEmails(scheduledSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [scheduledSearch, fetchScheduledEmails]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSentEmails(sentSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [sentSearch, fetchSentEmails]);

  // Cancel Scheduled Email
  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      showNotification("Scheduled email was cancelled.", "info");
      setScheduledEmails((prev) => prev.filter((e) => e.id !== id));
      fetchStats();
    } catch (err: any) {
      showNotification(err.response?.data?.message || "Failed to cancel email.", "error");
    }
  };

  // On compose success
  const handleScheduleSuccess = () => {
    showNotification("Emails successfully queued and scheduled!", "success");
    handleRefreshAll();
  };

  return (
    <div className="min-h-screen bg-surface-bg text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner Alert if any */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between transition-all shadow-md animate-fadeIn ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : notification.type === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-blue-500/10 border-blue-500/30 text-blue-300"
            }`}
          >
            <div className="flex items-center space-x-3">
              {notification.type === "success" && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
              {notification.type === "error" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              {notification.type === "info" && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs hover:underline opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Section & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-surface-border gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Email Job Scheduler
            </h1>
            <p className="text-sm text-surface-muted mt-1">
              Production-grade asynchronous email delivery backed by BullMQ, Redis, PostgreSQL & Elasticsearch
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-surface-card border border-surface-border text-surface-muted hover:text-white hover:bg-surface-hover transition-colors flex items-center justify-center shadow-sm"
              title="Refresh queue and emails"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-brand-400" : ""}`} />
            </button>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:via-indigo-500 hover:to-purple-500 text-white font-medium text-sm shadow-lg shadow-brand-500/25 transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Stats & Rate Limits Dashboard Bar */}
        <StatsBar statsData={statsData} />

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-border space-x-6 mb-6">
          <button
            onClick={() => setActiveTab("scheduled")}
            className={`flex items-center space-x-2 pb-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === "scheduled"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-surface-muted hover:text-gray-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Scheduled Emails</span>
            <span
              className={`ml-1.5 px-2 py-0.5 text-xs rounded-full ${
                activeTab === "scheduled"
                  ? "bg-brand-500/20 text-brand-300"
                  : "bg-surface-card text-surface-muted border border-surface-border"
              }`}
            >
              {statsData?.stats.scheduled ?? scheduledEmails.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("sent")}
            className={`flex items-center space-x-2 pb-3 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === "sent"
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-surface-muted hover:text-gray-300"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Sent Emails</span>
            <span
              className={`ml-1.5 px-2 py-0.5 text-xs rounded-full ${
                activeTab === "sent"
                  ? "bg-brand-500/20 text-brand-300"
                  : "bg-surface-card text-surface-muted border border-surface-border"
              }`}
            >
              {statsData?.stats.sent ?? sentEmails.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "scheduled" ? (
          <ScheduledTab
            emails={scheduledEmails}
            isLoading={isLoadingScheduled}
            searchQuery={scheduledSearch}
            onSearchChange={setScheduledSearch}
            onRefresh={() => fetchScheduledEmails(scheduledSearch)}
            onCancelEmail={handleCancelEmail}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTab
            emails={sentEmails}
            isLoading={isLoadingSent}
            searchQuery={sentSearch}
            onSearchChange={setSentSearch}
            onRefresh={() => fetchSentEmails(sentSearch)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-6 text-center text-xs text-surface-muted bg-surface-card/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Built for <span className="font-semibold text-white">ReachInbox.ai</span> Full-stack Email Job Scheduler
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              BullMQ Real-Time Board
            </a>
            <span>•</span>
            <button
              onClick={() => setIsSlackModalOpen(true)}
              className="hover:text-white transition-colors"
            >
              Slack Integration
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduleSuccess={handleScheduleSuccess}
        defaultSender="maci.smith@ethereal.email"
      />

      <SlackModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        status={slackStatus}
        onStatusChange={() => {
          fetchSlackStatus();
          showNotification("Slack integration updated successfully.", "success");
        }}
      />

      <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainDashboard />
    </AuthProvider>
  );
}
