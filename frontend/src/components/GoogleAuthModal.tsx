import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { X, LogIn, AlertCircle, ShieldCheck, User } from "lucide-react";

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogleCredential, loginDemo } = useAuth();
  const [clientId, setClientId] = useState(
    () => localStorage.getItem("reachinbox_google_client_id") || ""
  );
  const [customName, setCustomName] = useState("Evaluation Reviewer");
  const [customEmail, setCustomEmail] = useState("evaluator@reachinbox.ai");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveClientId = (val: string) => {
    setClientId(val);
    localStorage.setItem("reachinbox_google_client_id", val);
  };

  const handleSuccess = async (credentialResponse: any) => {
    try {
      if (credentialResponse.credential) {
        await loginWithGoogleCredential(credentialResponse.credential);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate with Google");
    }
  };

  const handleDemoSignIn = async () => {
    try {
      await loginDemo(customName, customEmail);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed demo login");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Google Authentication</h2>
              <p className="text-xs text-surface-muted">
                Sign in with real Google OAuth to access scheduler
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

          {/* Real Google OAuth Login */}
          <div className="p-4 bg-surface-bg border border-surface-border rounded-xl space-y-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-white">Real Google OAuth 2.0</p>
            </div>

            {clientId ? (
              <GoogleOAuthProvider clientId={clientId}>
                <div className="flex justify-center pt-2">
                  <GoogleLogin
                    onSuccess={handleSuccess}
                    onError={() => setError("Google login prompt closed or failed.")}
                    theme="filled_black"
                    shape="pill"
                    size="large"
                  />
                </div>
              </GoogleOAuthProvider>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-surface-muted">
                  Enter your Google Client ID below to enable live Google One-Tap & OAuth button:
                </p>
                <input
                  type="text"
                  placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => handleSaveClientId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-surface-card border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            )}
          </div>

          {/* Quick Demo Sign In */}
          <div className="pt-2 border-t border-surface-border space-y-3">
            <p className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
              <User className="w-4 h-4 text-brand-400" />
              <span>Direct Sign-in Profile</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-2.5 py-1.5 text-xs bg-surface-bg border border-surface-border rounded-lg text-white"
              />
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full px-2.5 py-1.5 text-xs bg-surface-bg border border-surface-border rounded-lg text-white"
              />
            </div>
            <button
              onClick={handleDemoSignIn}
              className="w-full py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-all shadow-md shadow-brand-500/20"
            >
              Sign In as {customName}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
