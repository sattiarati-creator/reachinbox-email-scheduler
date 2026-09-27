import React, { useState } from "react";
import type { SlackStatus } from "../types";
import { api } from "../services/api";
import { X, Bell, CheckCircle2, AlertCircle, ExternalLink, Send, Trash2 } from "lucide-react";

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SlackStatus | null;
  onStatusChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusChange,
}) => {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("email-alerts");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTestResult(null);

    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      setError("Please enter a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.connectSlackWebhook(webhookUrl, channelName);
      setWebhookUrl("");
      onStatusChange();
      setTestResult({
        success: true,
        message: "Slack webhook connected! You can now send a test alert.",
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to connect Slack webhook");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthConnect = async () => {
    setError(null);
    try {
      const url = await api.getSlackOAuthUrl();
      if (!url) {
        setError(
          "Slack OAuth credentials (SLACK_CLIENT_ID) not configured in backend .env. Use Direct Webhook below for instant testing!"
        );
        return;
      }
      window.location.href = url;
    } catch (err: any) {
      setError("Failed to generate Slack OAuth URL: " + err.message);
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);
    try {
      await api.sendSlackTestNotification();
      setTestResult({
        success: true,
        message: "Live test message delivered to your Slack channel successfully! 🚀",
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to send test alert to Slack.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectSlack();
      onStatusChange();
      setTestResult(null);
    } catch (err: any) {
      setError(err.message || "Failed to disconnect Slack.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Slack Rate Limit Alerts</h2>
              <p className="text-xs text-surface-muted">
                Receive instant notifications when sender hourly limits are hit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-surface-muted hover:text-white rounded-lg hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {testResult && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Current Connection Status */}
          <div className="p-4 bg-surface-bg border border-surface-border rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-3 h-3 rounded-full ${
                    status?.connected ? "bg-emerald-400 shadow-sm shadow-emerald-500" : "bg-gray-500"
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold text-white">
                    {status?.connected
                      ? `Connected to ${status.teamName || "Workspace"}`
                      : "Slack Not Connected"}
                  </p>
                  <p className="text-[11px] text-surface-muted">
                    {status?.connected
                      ? `Active channel: #${status.channelName || "alerts"}`
                      : "Rate-limit events will skip notifications quietly until connected"}
                  </p>
                </div>
              </div>

              {status?.connected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="p-1.5 text-surface-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Disconnect Slack"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {status?.connected && (
              <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-between">
                <span className="text-[11px] text-surface-muted">Verify live Slack delivery:</span>
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isTesting}
                  className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>{isTesting ? "Sending Alert..." : "Send Test Alert"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Connect Option 1: Direct Webhook */}
          <form onSubmit={handleConnectWebhook} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Direct Incoming Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                className="w-full px-3 py-2 text-xs bg-surface-bg border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
              <p className="text-[11px] text-surface-muted mt-1">
                Paste any Slack webhook to verify live alerts immediately.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Channel (e.g. #reachinbox-alerts)"
                className="w-1/2 px-3 py-1.5 text-xs bg-surface-bg border border-surface-border rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                disabled={isSubmitting || !webhookUrl}
                className="w-1/2 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
              >
                {isSubmitting ? "Saving..." : "Connect Webhook"}
              </button>
            </div>
          </form>

          {/* Connect Option 2: OAuth Flow */}
          <div className="pt-3 border-t border-surface-border">
            <p className="text-xs font-medium text-gray-400 mb-2">Or Authorize via Slack OAuth:</p>
            <button
              type="button"
              onClick={handleOAuthConnect}
              className="w-full py-2 px-4 text-xs font-medium text-white bg-surface-hover hover:bg-gray-800 border border-surface-border rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <span>Connect Slack via OAuth</span>
              <ExternalLink className="w-3.5 h-3.5 text-surface-muted" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-bg/50 border-t border-surface-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-surface-muted hover:text-white bg-surface-hover rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
