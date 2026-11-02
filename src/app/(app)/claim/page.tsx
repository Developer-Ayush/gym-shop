"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/context/AuthContext";
import { claimOrder, errorMessage } from "@/lib/shopApi";
import { inr } from "@/lib/format";
import type { ClaimResult } from "@/types";

// The camera code only runs in the browser
const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

const inputCls =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none focus:border-amber-500";

export default function ClaimPage() {
  const { user } = useAuth();
  const [invoiceId, setInvoiceId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const invoiceValid = /^\d{7,8}$/.test(invoiceId.trim());

  async function verify(tokenToCheck: string) {
    if (!user) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      setResult(await claimOrder(invoiceId, tokenToCheck, user.uid));
    } catch (e) {
      setErr(errorMessage(e));
    }
    setBusy(false);
  }

  function handleScan(text: string) {
    setScanning(false);
    setToken(text);
    if (invoiceValid) {
      verify(text);
    } else {
      setErr("QR scanned. Now enter the 7-8 digit invoice ID, then tap Verify.");
    }
  }

  function reset() {
    setInvoiceId("");
    setToken(null);
    setManualToken("");
    setShowManual(false);
    setResult(null);
    setErr(null);
  }

  /* ----------------------------- Scanner screen ---------------------------- */
  if (scanning) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black px-5 pt-6">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Scan invoice QR</h2>
            <button
              onClick={() => setScanning(false)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
            >
              Close
            </button>
          </div>
          <QrScanner onScan={handleScan} />
          <p className="mt-4 text-center text-sm text-slate-400">
            Point the camera at the QR code on the customer&apos;s invoice.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------------ Result screen ---------------------------- */
  if (result) {
    const ok = result.ok;
    const already = !result.ok && result.reason === "already_delivered";
    const tone = ok
      ? "border-emerald-800 bg-emerald-950"
      : already
      ? "border-amber-800 bg-amber-950"
      : "border-red-900 bg-red-950";

    return (
      <main className="px-5 pt-6">
        <div className={`rounded-3xl border p-6 text-center ${tone}`}>
          <p className="text-5xl">{ok ? "✅" : already ? "⚠️" : "❌"}</p>
          <h1 className="mt-3 text-2xl font-bold">
            {ok ? "Verified. Hand over the items" : already ? "Already delivered" : "Cannot claim"}
          </h1>
          {!result.ok && <p className="mt-2 text-slate-300">{result.message}</p>}
        </div>

        {result.ok && (
          <section className="mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs text-slate-400">Invoice</p>
            <p className="font-mono text-xl font-bold">{result.order.invoiceId}</p>
            <p className="mt-3 text-xs text-slate-400">Customer</p>
            <p className="font-semibold">{result.order.buyerName}</p>

            <ul className="mt-4 divide-y divide-slate-800">
              {result.order.items.map((i) => (
                <li key={i.productId} className="flex justify-between py-2 text-sm">
                  <span>
                    {i.name} <span className="text-slate-400">× {i.qty}</span>
                  </span>
                  <span>{inr(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-slate-800 pt-3 font-bold">
              <span>Total</span>
              <span>{inr(result.order.total)}</span>
            </div>
          </section>
        )}

        <button
          onClick={reset}
          className="mt-6 w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-slate-950 active:scale-[0.98]"
        >
          Next customer
        </button>
      </main>
    );
  }

  /* ------------------------------- Form screen ----------------------------- */
  return (
    <main className="px-5 pt-4">
      <h1 className="text-2xl font-bold">Claim order</h1>
      <p className="mt-1 text-sm text-slate-400">
        Type the invoice ID, then scan the QR code printed on the customer&apos;s invoice.
      </p>

      <label className="mb-1 mt-6 block text-xs text-slate-400">Invoice ID</label>
      <input
        value={invoiceId}
        onChange={(e) => setInvoiceId(e.target.value.replace(/\D/g, "").slice(0, 8))}
        inputMode="numeric"
        placeholder="1000001"
        className={`${inputCls} text-center font-mono text-2xl tracking-widest`}
      />

      <button
        onClick={() => {
          setErr(null);
          setScanning(true);
        }}
        disabled={busy}
        className="mt-4 w-full rounded-2xl bg-amber-500 py-4 text-base font-bold text-slate-950 active:scale-[0.98] disabled:opacity-60"
      >
        📷 Scan invoice QR
      </button>

      {token && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <span className="text-sm text-emerald-300">QR code scanned</span>
          <button
            onClick={() => verify(token)}
            disabled={!invoiceValid || busy}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            {busy ? "Checking..." : "Verify"}
          </button>
        </div>
      )}

      {err && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {err}
        </p>
      )}

      {/* Useful for testing on a laptop without a second screen */}
      <div className="mt-8">
        <button
          onClick={() => setShowManual((v) => !v)}
          className="text-sm text-slate-400 underline"
        >
          {showManual ? "Hide manual entry" : "No camera? Enter the token manually"}
        </button>
        {showManual && (
          <div className="mt-3">
            <textarea
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              rows={3}
              placeholder="Paste the secret token"
              className={`${inputCls} font-mono text-xs`}
            />
            <button
              onClick={() => verify(manualToken)}
              disabled={!invoiceValid || !manualToken.trim() || busy}
              className="mt-3 w-full rounded-2xl bg-slate-800 py-3 font-semibold disabled:opacity-40"
            >
              {busy ? "Checking..." : "Verify token"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}