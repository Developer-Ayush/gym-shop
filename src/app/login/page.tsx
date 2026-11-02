"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, error, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/products/");
  }, [user, loading, router]);

  async function handleLogin() {
    setBusy(true);
    await signInWithGoogle();
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-6 py-12">
      <div className="mt-16">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl">
          🛒
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Gym Shop</h1>
        <p className="mt-3 text-slate-400">
          Manage products and stock, and hand over supplement orders securely.
        </p>
      </div>

      <div>
        {error && (
          <p className="mb-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          onClick={handleLogin}
          disabled={busy || loading}
          className="w-full rounded-2xl bg-white px-5 py-4 text-base font-semibold text-slate-900 transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}