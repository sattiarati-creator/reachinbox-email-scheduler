import React from "react";
import { useAuth } from "../context/AuthContext";
import type { SlackStatus } from "../types";
import { LogOut, ExternalLink, Bell, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  slackStatus: SlackStatus | null;
  onOpenSlackModal: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  slackStatus,
  onOpenSlackModal,
  onOpenAuthModal,
}) => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="border-b border-surface-border bg-surface-card/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white">
                ReachInbox
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Scheduler Pro
              </span>
            </div>
            <p className="text-xs text-surface-muted">
              High-throughput BullMQ & Redis Engine
            </p>
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center space-x-4">
          {/* BullMQ Dashboard Link */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
            title="Open Live BullMQ Queue Dashboard"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>BullMQ Live Board</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
          </a>

          {/* Slack Integration Button */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              slackStatus?.connected
                ? "bg-purple-950/40 text-purple-300 border-purple-800/60 hover:bg-purple-900/50"
                : "bg-surface-border text-surface-muted border-gray-700 hover:text-white hover:bg-surface-hover"
            }`}
          >
            {slackStatus?.connected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Slack: {slackStatus.teamName || "Connected"}</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span>Connect Slack</span>
              </>
            )}
          </button>

          {/* User Profile / Login */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-surface-border">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-surface-border object-cover bg-surface-hover"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-white truncate max-w-[130px]">
                  {user.name}
                </p>
                <p className="text-[11px] text-surface-muted truncate max-w-[130px]">
                  {user.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-surface-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors shadow-sm"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
