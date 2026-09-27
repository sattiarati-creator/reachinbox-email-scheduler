import React, { useState, useRef } from "react";
import type { ScheduleEmailPayload } from "../types";
import { X, Upload, Check, AlertCircle, Calendar, Clock, Download, Plus } from "lucide-react";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleSuccess: () => void;
  defaultSender?: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onScheduleSuccess,
  defaultSender = "maci.smith@ethereal.email",
}) => {
  const [sender, setSender] = useState(defaultSender);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [singleRecipient, setSingleRecipient] = useState("");
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default start time to 1 minute in the future formatted for datetime-local input
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 1000);
    // Format YYYY-MM-DDTHH:mm
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Extract email addresses from file contents
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Extract all valid emails using standard regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = text.match(emailRegex) || [];
      const uniqueEmails = Array.from(new Set(matches.map((email) => email.toLowerCase())));

      if (uniqueEmails.length === 0) {
        setError("No valid email addresses found in the uploaded file.");
        setRecipientsList([]);
      } else {
        setRecipientsList(uniqueEmails);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      "name,email,company\n" +
      "Alice Walker,alice.walker@example.com,Acme Corp\n" +
      "Bob Henderson,bob.henderson@example.com,Initech\n" +
      "Charlie Davis,charlie.davis@example.com,Hooli\n" +
      "Diana Prince,diana.prince@example.com,Wayne Tech\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "reachinbox_sample_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Combine uploaded recipients and single recipient if provided
    let finalRecipients = [...recipientsList];
    if (singleRecipient.trim()) {
      const singleList = singleRecipient
        .split(/[,\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@"));
      finalRecipients = Array.from(new Set([...finalRecipients, ...singleList]));
    }

    if (finalRecipients.length === 0) {
      setError("Please provide at least one recipient email address or upload a CSV file.");
      return;
    }

    if (!subject.trim()) {
      setError("Email subject is required.");
      return;
    }

    if (!body.trim()) {
      setError("Email body content is required.");
      return;
    }

    const scheduledDate = new Date(startTime);
    if (isNaN(scheduledDate.getTime())) {
      setError("Invalid start time selected.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: ScheduleEmailPayload = {
        sender: sender.trim() || defaultSender,
        recipients: finalRecipients,
        subject: subject.trim(),
        body: body.trim(),
        scheduledAt: scheduledDate.toISOString(),
        delaySeconds: Number(delaySeconds) || 2,
        hourlyLimit: Number(hourlyLimit) || 10,
      };

      const response = await fetch("/api/emails/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to schedule email.");
      }

      onScheduleSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to schedule emails. Please check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border sticky top-0 bg-surface-card z-10">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compose & Schedule Email</h2>
              <p className="text-xs text-surface-muted">
                Configure sequence leads, provider throttle delay & rate limit
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Sender Address (SMTP Account)
            </label>
            <input
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="e.g. maci.smith@ethereal.email"
              required
              className="w-full px-3.5 py-2 text-sm bg-surface-bg border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <p className="text-[11px] text-surface-muted mt-1">
              Supports multi-sender throttling and per-sender rate limiting.
            </p>
          </div>

          {/* CSV File Upload Section */}
          <div className="border border-dashed border-surface-border rounded-xl p-4 bg-surface-bg/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300">
                Upload Leads (CSV or TXT)
              </span>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="flex items-center space-x-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sample CSV</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer py-4 px-3 flex flex-col items-center justify-center border border-surface-border rounded-lg hover:border-brand-500/50 hover:bg-brand-500/5 transition-all text-center"
            >
              <Upload className="w-6 h-6 text-brand-400 mb-1.5" />
              <p className="text-xs font-medium text-white">
                {uploadedFileName ? uploadedFileName : "Click or drag CSV file here to upload"}
              </p>
              <p className="text-[11px] text-surface-muted mt-0.5">
                Automatically extracts and validates email addresses
              </p>
            </div>

            {/* Detected Leads Indicator */}
            {recipientsList.length > 0 && (
              <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-300">
                    {recipientsList.length} lead email address
                    {recipientsList.length > 1 ? "es" : ""} detected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientsList([]);
                    setUploadedFileName("");
                  }}
                  className="text-[11px] text-surface-muted hover:text-rose-400 underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Or Manual Recipient Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Recipient(s) (Optional if CSV uploaded)
            </label>
            <input
              type="text"
              value={singleRecipient}
              onChange={(e) => setSingleRecipient(e.target.value)}
              placeholder="e.g. client@example.com (comma separated for multiples)"
              className="w-full px-3.5 py-2 text-sm bg-surface-bg border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Transforming your outbound with ReachInbox AI"
              required
              className="w-full px-3.5 py-2 text-sm bg-surface-bg border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Email Body
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{name}},&#10;&#10;I came across your work and wanted to connect..."
              required
              className="w-full px-3.5 py-2.5 text-sm bg-surface-bg border border-surface-border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none font-sans"
            />
          </div>

          {/* Scheduling Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-surface-border">
            {/* Start Time */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-brand-400" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-surface-bg border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Delay Between Sends */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                <span>Delay Between (sec)</span>
              </label>
              <input
                type="number"
                min={1}
                max={300}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-surface-bg border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                Hourly Limit (emails/hr)
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-surface-bg border border-surface-border rounded-lg text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-surface-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-surface-muted hover:text-white bg-surface-hover rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-brand-500/20 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scheduling into BullMQ...</span>
                </>
              ) : (
                <span>Schedule Emails</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
