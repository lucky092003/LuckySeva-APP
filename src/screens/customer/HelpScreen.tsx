import * as Icons from 'lucide-react';
import { useState } from 'react';
import { TopBar } from '@/components/PhoneShell';
import { Card } from '@/components/ui';

const FAQS = [
  { q: 'How do I book a service?', a: 'Select a category from the home screen, choose your service, pick a date and time slot, add your address, and confirm. A professional will be assigned automatically.' },
  { q: 'What payment methods are supported?', a: 'We support UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and Cash on service completion. Online payments are secured by Razorpay.' },
  { q: 'Can I cancel or reschedule a booking?', a: 'Yes. Go to My Bookings, find your booking, and tap Cancel. You can reschedule by creating a new booking for your preferred time.' },
  { q: 'What if I am not satisfied with the service?', a: 'Every booking comes with a 30-day service warranty. If you are not satisfied, raise a complaint from your booking details and our team will resolve it within 24 hours.' },
  { q: 'How do I apply a coupon code?', a: 'Enter your coupon code on the review step of the booking flow. The discount will be applied to your total instantly.' },
  { q: 'Are the professionals verified?', a: 'Yes. Every professional on LuckySeva is background-verified, skill-tested, and carries a government ID check before being onboarded.' },
];

export const HelpScreen = () => {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50">
      <TopBar title="Help & Support" />
      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Contact card */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Icons.Phone size={20} />
            </div>
            <p className="mt-2 text-xs font-bold text-gray-900">Call Us</p>
            <p className="text-[11px] text-gray-500">1800-200-9876</p>
          </Card>
          <Card className="flex flex-col items-center p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Icons.MessageCircle size={20} />
            </div>
            <p className="mt-2 text-xs font-bold text-gray-900">Chat</p>
            <p className="text-[11px] text-gray-500">24x7 support</p>
          </Card>
        </div>

        {/* Email */}
        <Card className="mb-4 flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Icons.Mail size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Email Support</p>
            <p className="text-[11px] text-gray-500">support@luckyseva.com</p>
          </div>
        </Card>

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
