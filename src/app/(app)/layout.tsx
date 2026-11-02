"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const TABS = [
  { href: "/products/", label: "Products", icon: "📦", ready: true },
  { href: "/claim/", label: "Claim", icon: "✅", ready: true },
  { href: "/orders/", label: "Orders", icon: "🧾", ready: true },
];

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isShopkeeper, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login/");
  }, [user, loading, router]);

  if (loading || !user) return <Spinner />;

  if (!isShopkeeper) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-400">
          This account is not a shopkeeper account. Ask the owner to set the role for:
        </p>
        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm">
          <p className="text-slate-400">Email</p>
          <p className="break-all">{user.email}</p>
          <p className="mt-3 text-slate-400">User ID</p>
          <p className="break-all font-mono text-xs">{user.uid}</p>
        </div>
        <button
          onClick={signOut}
          className="mt-6 rounded-2xl border border-slate-700 py-3 font-semibold active:bg-slate-900"
        >
          Sign out
        </button>
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <header className="flex items-center justify-between px-5 pt-6">
        <p className="text-sm text-slate-400">🛒 Gym Shop</p>
        <button
          onClick={signOut}
          className="rounded-xl border border-slate-800 px-3 py-1.5 text-xs text-slate-400 active:bg-slate-900"
        >
          Sign out
        </button>
      </header>

      {children}

      <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
        <ul className="flex">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href.slice(0, -1));
            const base = "flex flex-col items-center gap-0.5 py-3 text-xs";
            return (
              <li key={tab.href} className="flex-1">
                {tab.ready ? (
                  <Link
                    href={tab.href}
                    className={`${base} ${active ? "text-amber-400" : "text-slate-400"}`}
                  >
                    <span className="text-xl">{tab.icon}</span>
                    {tab.label}
                  </Link>
                ) : (
                  <div className={`${base} text-slate-700`}>
                    <span className="text-xl opacity-40">{tab.icon}</span>
                    {tab.label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}