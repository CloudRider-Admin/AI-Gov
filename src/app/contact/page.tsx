import { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquare, User } from "lucide-react";
import { Breadcrumb } from "@/components/ui";
import { Footer } from "@/components/sections";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the GovSecure team. We respond to all enquiries within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Us | GovSecure",
    description: "Get in touch with the GovSecure team. We respond to all enquiries within one business day.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <>
      <div className="section min-h-screen">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: "Contact" }]} />

          {/* Header */}
          <header className="mb-16 text-center">
            <span className="font-mono text-terminal-green text-sm uppercase tracking-wider mb-4 block">
              Get In Touch
            </span>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-terminal-text mb-4">
              Contact Us
            </h1>
            <p className="text-lg text-terminal-muted font-sans max-w-2xl mx-auto">
              Have a question, feedback, or need help? We typically respond within one business day.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-5xl mx-auto">
            {/* Contact info sidebar */}
            <div className="space-y-5">
              <div className="card p-6">
                <div className="w-10 h-10 flex items-center justify-center border border-terminal-green/30 rounded-xl bg-terminal-green/5 mb-4">
                  <Mail className="w-5 h-5 text-terminal-green" />
                </div>
                <h3 className="font-mono text-sm font-bold text-terminal-text mb-1">Email</h3>
                <p className="text-terminal-muted font-sans text-sm">hello@govsecure.ai</p>
              </div>

              <div className="card p-6">
                <div className="w-10 h-10 flex items-center justify-center border border-terminal-green/30 rounded-xl bg-terminal-green/5 mb-4">
                  <MessageSquare className="w-5 h-5 text-terminal-green" />
                </div>
                <h3 className="font-mono text-sm font-bold text-terminal-text mb-1">Response Time</h3>
                <p className="text-terminal-muted font-sans text-sm">Within 1 business day for all enquiries.</p>
              </div>

              <div className="card p-6">
                <div className="w-10 h-10 flex items-center justify-center border border-terminal-green/30 rounded-xl bg-terminal-green/5 mb-4">
                  <User className="w-5 h-5 text-terminal-green" />
                </div>
                <h3 className="font-mono text-sm font-bold text-terminal-text mb-1">Looking for answers?</h3>
                <p className="text-terminal-muted font-sans text-sm mb-3">
                  Check our FAQ page — most common questions are answered there.
                </p>
                <Link
                  href="/faq"
                  className="font-mono text-sm text-terminal-green hover:underline"
                >
                  View FAQs →
                </Link>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2 card p-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
