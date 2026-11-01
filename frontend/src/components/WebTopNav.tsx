import {
  Home,
  CalendarCheck,
  LayoutGrid,
  BriefcaseBusiness,
  ChevronDown,
  Search,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useApp, Screen, Role } from "@/context/app-context";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { isNative } from "@/utils/native";

const customerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: "Home", icon: Home, screen: { name: "home" } },
  { label: "Services", icon: LayoutGrid, screen: { name: "services" } },
  { label: "Bookings", icon: CalendarCheck, screen: { name: "bookings" } },
];

const providerItems: { label: string; icon: typeof Home; screen: Screen }[] = [
  { label: "Requests", icon: Home, screen: { name: "provider-home" } },
  {
    label: "Bookings",
    icon: CalendarCheck,
    screen: { name: "provider-bookings" },
  },
  {
    label: "Earnings",
    icon: LayoutGrid,
    screen: { name: "provider-earnings" },
  },
];

export const WebTopNav = ({ role }: { role: Role }) => {
  const { screen, navigate, customer, providerId } = useApp();
  const [searchValue, setSearchValue] = useState(
    screen.name === "search" ? screen.q || "" : "",
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);
  if (isNative) return null;
  if (screen.name === "auth" || screen.name === "provider-auth") return null;
  const items =
    role === "provider" ? providerItems : role === "admin" ? [] : customerItems;
  if (!items.length) return null;
  const activeRoutes: Record<string, string[]> =
    role === "provider"
      ? {
          Requests: ["provider-home", "provider-detail"],
          Bookings: ["provider-bookings", "invoice"],
          Earnings: ["provider-earnings"],
          Assistant: ["assistant"],
        }
      : {
          Home: ["home"],
          Bookings: [
            "bookings",
            "tracking",
            "booking-success",
            "invoice",
            "reviews",
          ],
          Services: [
            "services",
            "category",
            "service",
            "professionals",
            "professional",
            "booking",
            "payment",
          ],
          Assistant: ["assistant"],
        };
  const showBell =
    (role === "customer" && !!customer) ||
    (role === "provider" && !!providerId);
  const accountName =
    role === "provider"
      ? "Partner workspace"
      : customer?.name || "Your account";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "L";
  const accountActive = (
    role === "provider"
      ? ["provider-profile", "help"]
      : [
          "profile",
          "addresses",
          "favourites",
          "help",
          "refunds",
          "notifications",
        ]
  ).includes(screen.name);

  return (
    <div className="sticky top-0 z-50 shrink-0 border-b border-gray-200/70 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/95">
      <nav className="hidden h-[76px] w-full items-center px-[25px] lg:flex">
        <div className="flex min-w-0 shrink-0 items-center gap-3.5">
          <button
            onClick={() => navigate(items[0].screen)}
            className="group flex shrink-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
          >
            <Logo
              size={38}
              className="rounded-xl shadow-sm ring-1 ring-gray-200/80 transition group-hover:shadow-md group-hover:ring-emerald-100 dark:ring-gray-700 dark:group-hover:ring-emerald-900/60"
            />
            <span className="text-[18px] font-extrabold tracking-tight">
              <span className="text-gray-900 dark:text-gray-100">Lucky</span>
              <span className="text-orange-500">Seva</span>
            </span>
          </button>
          {role === "provider" && (
            <span className="hidden border-l border-gray-200 pl-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 xl:block dark:border-gray-800">
              Partner
            </span>
          )}
        </div>

        {role === "customer" && (
          <div className="relative ml-8 hidden xl:block">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={searchValue}
              onChange={(e) => {
                const value = e.target.value;
                setSearchValue(value);
                navigate({ name: "search", q: value });
              }}
              onFocus={() => {
                if (screen.name !== "search")
                  navigate({ name: "search", q: searchValue });
              }}
              placeholder="Search services, categories, professionals..."
              aria-label="Search services, categories and professionals"
              className="h-10 w-[300px] rounded-full border border-gray-200 bg-white pl-11 pr-4 text-[13px] text-gray-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/10 xl:w-[340px] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
            />
          </div>
        )}

        <div className="ml-auto flex h-full items-center gap-1">
          {items.map((tab) => {
            const Icon = tab.icon;
            const isActive = (
              activeRoutes[tab.label] || [tab.screen.name]
            ).includes(screen.name);
            return (
              <button
                key={tab.label}
                onClick={() => navigate(tab.screen)}
                aria-current={isActive ? "page" : undefined}
                className={`group relative flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isActive ? "bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/50" : "text-slate-500 hover:bg-emerald-50/70 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"}`}
              >
                <Icon
                  size={17}
                  className={
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 group-hover:text-emerald-600 dark:text-slate-500 dark:group-hover:text-emerald-400"
                  }
                  strokeWidth={isActive ? 2.4 : 2}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2.5">
          {showBell && (
            <div className="relative">
              <NotificationBell />
            </div>
          )}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-label={`Open ${role === "provider" ? "partner" : "account"} profile`}
              className={`flex items-center gap-1 rounded-full border py-1 pl-1 pr-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${accountActive ? "border-emerald-200 bg-emerald-50/70 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40" : "border-gray-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/40 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/30"}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-xs font-bold text-white shadow-inner">
                {role === "provider" ? (
                  <BriefcaseBusiness size={15} />
                ) : (
                  accountInitial
                )}
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
                {/* Short details */}
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-sm font-bold text-white shadow-inner">
                    {role === "provider" ? (
                      <BriefcaseBusiness size={18} />
                    ) : (
                      accountInitial
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                      {accountName}
                    </p>
                    {role === "customer" && customer && (
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {customer.phone && <p className="truncate">📞 {customer.phone}</p>}
                        {customer.email && <p className="truncate">✉️ {customer.email}</p>}
                        {customer.location && <p className="truncate">📍 {customer.location}</p>}
                      </div>
                    )}
                    {role === "provider" && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Partner workspace
                      </p>
                    )}
                  </div>
                </div>

                {/* Full view profile */}
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    navigate(
                      role === "provider"
                        ? { name: "provider-profile" }
                        : { name: "profile" },
                    );
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                >
                  <span className="flex-1">View full profile</span>
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <div className="hidden h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent md:block" />
    </div>
  );
};
