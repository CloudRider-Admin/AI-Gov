"use client";

import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";

const topics = [
  "General Enquiry",
  "Technical Support",
  "Billing & Plans",
  "Feature Request",
  "Partnership",
  "Other",
];

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", topic: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle className="w-14 h-14 text-terminal-green mb-4" />
        <h2 className="font-mono text-2xl font-bold text-terminal-text mb-2">Message Sent</h2>
        <p className="text-terminal-muted font-sans text-sm max-w-sm">
          Thanks for reaching out. We&apos;ll get back to you at{" "}
          <span className="text-terminal-text">{form.email}</span> within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="font-mono text-xs text-terminal-muted uppercase tracking-wider block mb-2">
            Name <span className="text-terminal-green">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Jane Smith"
            className="w-full px-4 py-3 bg-terminal-gray border border-terminal-border rounded-md font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-green transition-colors"
          />
        </div>

        <div>
          <label className="font-mono text-xs text-terminal-muted uppercase tracking-wider block mb-2">
            Email <span className="text-terminal-green">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="jane@company.com"
            className="w-full px-4 py-3 bg-terminal-gray border border-terminal-border rounded-md font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-green transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="font-mono text-xs text-terminal-muted uppercase tracking-wider block mb-2">
          Topic
        </label>
        <select
          name="topic"
          value={form.topic}
          onChange={handleChange}
          className="w-full px-4 py-3 bg-terminal-gray border border-terminal-border rounded-md font-mono text-sm text-terminal-text focus:outline-none focus:border-terminal-green transition-colors appearance-none"
        >
          <option value="">Select a topic...</option>
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="font-mono text-xs text-terminal-muted uppercase tracking-wider block mb-2">
          Message <span className="text-terminal-green">*</span>
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          required
          rows={6}
          placeholder="How can we help you?"
          className="w-full px-4 py-3 bg-terminal-gray border border-terminal-border rounded-md font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-green transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center gap-2 px-6 py-3 bg-terminal-green text-terminal-black font-mono text-sm font-bold rounded-md hover:bg-terminal-green-dim transition-colors"
      >
        <Send className="w-4 h-4" />
        Send Message
      </button>
    </form>
  );
}
