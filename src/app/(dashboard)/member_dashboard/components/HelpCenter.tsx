"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Clock, CheckCircle, Info, Loader2 } from "lucide-react";

type Ticket = {
  ticket_id: number;
  subject: string;
  message: string;
  status: "Pending" | "In Progress" | "Resolved";
  created_at: string;
};

export function HelpCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [form, setForm] = useState({ subject: "", message: "" });

  const fetchTickets = () => {
    setIsFetching(true);
    fetch("/api/members/me/support")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTickets(data);
      })
      .catch(console.error)
      .finally(() => setIsFetching(false));
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMsg({ text: "", type: "" });

    try {
      const res = await fetch("/api/members/me/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to submit ticket");

      setMsg({ text: "Message sent to Admin! We will review it shortly.", type: "success" });
      setForm({ subject: "", message: "" });
      fetchTickets();
    } catch (err: any) {
      setMsg({ text: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setMsg({ text: "", type: "" }), 5000);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Form */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          <div className="rounded-3xl bg-[#123D2A] p-8 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-[#1F6B43]/50 to-transparent"></div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold">Need Help?</h3>
              <p className="mt-2 text-sm text-white/80">Send a direct message to the Coop Admin regarding your account, share capital, or any other concerns.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
            <h4 className="font-bold text-[#173626] mb-4">Submit a Request</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Subject</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="E.g., Share Capital Payment Not Reflecting"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-[#4b6b5a]">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  placeholder="Please provide details about your concern..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 py-3 px-4 text-sm outline-none transition focus:border-[#2F7D57] focus:ring-1 focus:ring-[#2F7D57]"
                ></textarea>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#123D2A] py-3 text-sm font-bold text-white transition hover:bg-[#1F6B43] disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Message
                </button>
                {msg.text && (
                  <div className={`mt-3 p-3 text-xs font-bold rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {msg.text}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: History */}
        <div className="lg:col-span-2">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-sm min-h-full">
            <h4 className="font-bold text-[#173626] mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
              <MessageSquare className="h-5 w-5 text-[#2F7D57]" /> Support History
            </h4>

            {isFetching ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <div className="rounded-full bg-gray-50 p-4 mb-3">
                  <Info className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">No support tickets found.</p>
                <p className="text-xs text-gray-400 mt-1">If you have an issue, send a message using the form.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {tickets.map(ticket => (
                  <div key={ticket.ticket_id} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-5 transition hover:shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-bold text-[#173626]">{ticket.subject}</h5>
                        <p className="text-xs font-bold text-gray-400 mt-1">
                          {new Date(ticket.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <div>
                        {ticket.status === 'Pending' && <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full"><Clock className="h-3 w-3" /> Pending</span>}
                        {ticket.status === 'In Progress' && <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full"><Info className="h-3 w-3" /> Reviewing</span>}
                        {ticket.status === 'Resolved' && <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full"><CheckCircle className="h-3 w-3" /> Resolved</span>}
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-600 bg-white p-4 rounded-xl border border-gray-100 whitespace-pre-wrap">
                      {ticket.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
