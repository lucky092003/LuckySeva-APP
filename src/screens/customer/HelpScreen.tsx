import * as Icons from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/lib/app-context';
import { useSupportTickets } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { TopBar } from '@/components/PhoneShell';
import { Card, Button, EmptyState } from '@/components/ui';

const FAQS = [
  { q: 'How do I book a service?', a: 'Select a category from the home screen, choose your service, pick a date and time slot, add your address, and confirm. A professional will be assigned automatically.' },
  { q: 'What payment methods are supported?', a: 'We support UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and Cash on service completion. Online payments are secured by Razorpay.' },
  { q: 'Can I cancel or reschedule a booking?', a: 'Yes. Go to My Bookings, find your booking, and tap Cancel. You can reschedule by creating a new booking for your preferred time.' },
  { q: 'What if I am not satisfied with the service?', a: 'Every booking comes with a 30-day service warranty. If you are not satisfied, raise a complaint from your booking details and our team will resolve it within 24 hours.' },
  { q: 'How do I apply a coupon code?', a: 'Enter your coupon code on the review step of the booking flow. The discount will be applied to your total instantly.' },
  { q: 'Are the professionals verified?', a: 'Yes. Every professional on LuckySeva is background-verified, skill-tested, and carries a government ID check before being onboarded.' },
];

export const HelpScreen = () => {
  const { customer } = useApp();
  const { tickets, reload } = useSupportTickets(customer?.phone || null);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    if (!customer?.phone || !draft.trim()) return;
    setSending(true);
    await supabase.from('support_tickets').insert({ customer_phone: customer.phone, message: draft.trim() });
    setDraft('');
    setSending(false);
    reload();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Help & Support" />
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 py-4">
        {/* Contact card */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <a href="tel:18002009876">
            <Card className="flex flex-col items-center p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icons.Phone size={20} />
              </div>
              <p className="mt-2 text-xs font-bold text-gray-900">Call Us</p>
              <p className="text-[11px] text-gray-500">1800-200-9876</p>
            </Card>
          </a>
          <button onClick={() => setChatOpen(true)}>
            <Card className="flex flex-col items-center p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Icons.MessageCircle size={20} />
              </div>
              <p className="mt-2 text-xs font-bold text-gray-900">Chat</p>
              <p className="text-[11px] text-gray-500">24x7 support</p>
            </Card>
          </button>
        </div>

        {/* Email */}
        <a href="mailto:support@luckyseva.com">
          <Card className="mb-4 flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Icons.Mail size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Email Support</p>
              <p className="text-[11px] text-gray-500">support@luckyseva.com</p>
            </div>
            <Icons.ChevronRight size={18} className="text-gray-300" />
          </Card>
        </a>

        {/* FAQs */}
        <h3 className="mb-2 text-sm font-bold text-gray-900">Frequently Asked Questions</h3>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>

        {/* About */}
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
          <h4 className="text-sm font-bold">About LuckySeva</h4>
          <p className="mt-1 text-xs leading-relaxed text-white/90">
            LuckySeva connects you with verified local service professionals for all your home needs.
            Trusted by over 50,000 customers across Bangalore. Your satisfaction is our priority.
          </p>
        </div>

        <p className="mt-4 text-center text-[10px] text-gray-400">LuckySeva v1.0.0 · Made with care in India</p>
      </div>

      {/* Chat sheet */}
      {chatOpen && (
        <div className="absolute inset-0 z-40 flex flex-col bg-gray-50">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-3">
            <button onClick={() => setChatOpen(false)} className="text-gray-400">
              <Icons.X size={20} />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Icons.Headphones size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">LuckySeva Support</p>
              <p className="text-[11px] text-emerald-600">● Online · replies instantly</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar space-y-2 p-4">
            {tickets.length === 0 ? (
              <EmptyState icon={<Icons.MessageCircle size={26} />} title="Start a conversation" subtitle="Tell us how we can help." />
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="rounded-2xl rounded-tr-sm bg-white px-4 py-2.5 shadow-sm">
                  <p className="text-sm text-gray-800">{t.message}</p>
                  <p className={`mt-1 text-[10px] font-semibold ${t.status === 'open' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {t.status === 'open' ? 'Sent · awaiting reply' : t.status}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={customer ? 'Type a message...' : 'Sign in to chat with support'}
              disabled={!customer}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-50"
            />
            <Button onClick={sendMessage} disabled={!draft.trim() || sending || !customer} className="h-11 w-11 px-0">
              <Icons.Send size={18} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        <Icons.ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-4 pb-4 text-xs leading-relaxed text-gray-600">{a}</p>}
    </Card>
  );
};