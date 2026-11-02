"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  createTestOrder,
  errorMessage,
  subscribeOrders,
  subscribeProducts,
} from "@/lib/shopApi";
import { formatWhen, inr } from "@/lib/format";
import type { Order, OrderStatus, Product } from "@/types";

const inputCls =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none focus:border-amber-500";

const STATUS_STYLE: Record<OrderStatus, string> = {
  ordered: "bg-amber-950 text-amber-300",
  delivered: "bg-emerald-950 text-emerald-300",
  cancelled: "bg-slate-800 text-slate-400",
};

type Filter = "all" | "ordered" | "delivered";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [showTest, setShowTest] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeOrders(
      (list) => {
        setOrders(list);
        setLoading(false);
      },
      (e) => {
        setError(errorMessage(e));
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const shown = orders.filter((o) => filter === "all" || o.status === filter);
  const waiting = orders.filter((o) => o.status === "ordered").length;

  return (
    <main className="px-5 pt-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-slate-400">{waiting} waiting to be claimed</p>
        </div>
        <button
          onClick={() => setShowTest(true)}
          className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-semibold active:bg-slate-900"
        >
          🧪 Test order
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["all", "ordered", "delivered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl py-2 text-xs font-semibold capitalize ${
              filter === f ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-slate-500">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">No orders here yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((o) => (
            <li key={o.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-bold">{o.invoiceId}</p>
                  <p className="text-sm text-slate-400">{o.buyerName}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    STATUS_STYLE[o.status]
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <p className="mt-3 text-sm text-slate-300">
                {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
              </p>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Ordered {formatWhen(o.createdAt)}</span>
                <span className="text-sm font-bold text-white">{inr(o.total)}</span>
              </div>
              {o.status === "delivered" && (
                <p className="mt-1 text-xs text-emerald-400">
                  Delivered {formatWhen(o.deliveredAt)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {showTest && <TestOrderSheet onClose={() => setShowTest(false)} />}
    </main>
  );
}

/* ------------------------------ Test order tool ----------------------------- */

function TestOrderSheet({ onClose }: { onClose: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState("Test Member");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{
    invoiceId: string;
    token: string;
    total: number;
    qr: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeProducts(
      (list) => setProducts(list.filter((p) => p.active && p.stock > 0)),
      (e) => setErr(errorMessage(e))
    );
    return unsubscribe;
  }, []);

  const lines = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const total = lines.reduce((sum, p) => sum + p.price * (qty[p.id] ?? 0), 0);

  function bump(p: Product, delta: number) {
    setQty((q) => ({
      ...q,
      [p.id]: Math.min(p.stock, Math.max(0, (q[p.id] ?? 0) + delta)),
    }));
  }

  async function create() {
    if (lines.length === 0) return setErr("Add at least one product.");
    setBusy(true);
    setErr(null);
    try {
      const res = await createTestOrder(
        lines.map((p) => ({ productId: p.id, qty: qty[p.id] })),
        buyer.trim() || "Test Member"
      );
      // The QR holds only the secret token
      const qr = await QRCode.toDataURL(res.token, { width: 320, margin: 2 });
      setCreated({ ...res, qr });
    } catch (e) {
      setErr(errorMessage(e));
    }
    setBusy(false);
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErr("Could not copy. Select the token text and copy it by hand.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-slate-800 bg-slate-900 p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{created ? "Test order created" : "New test order"}</h2>
          <button onClick={onClose} className="px-2 text-slate-400">
            ✕
          </button>
        </div>

        {created ? (
          <div className="text-center">
            <p className="text-xs text-slate-400">Invoice ID</p>
            <p className="font-mono text-4xl font-bold tracking-widest">{created.invoiceId}</p>
            <p className="mt-1 text-sm text-slate-400">Total {inr(created.total)}</p>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={created.qr}
              alt="Invoice QR"
              className="mx-auto mt-4 h-56 w-56 rounded-2xl bg-white"
            />

            <p className="mt-4 break-all rounded-xl bg-black p-3 font-mono text-xs text-slate-300">
              {created.token}
            </p>
            <button
              onClick={copyToken}
              className="mt-3 w-full rounded-2xl bg-slate-800 py-3 text-sm font-semibold"
            >
              {copied ? "Copied ✓" : "Copy token"}
            </button>
            <p className="mt-3 text-xs text-slate-500">
              The token is shown only once, like a real invoice. The database keeps just its hash.
              Stock was already reduced for this order.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-slate-950"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Works like a member purchase: stock is reduced right away and an invoice with a
              secret token is created.
            </p>

            <label className="mb-1 block text-xs text-slate-400">Customer name</label>
            <input value={buyer} onChange={(e) => setBuyer(e.target.value)} className={inputCls} />

            <p className="mb-2 mt-4 text-xs text-slate-400">Products</p>
            {products.length === 0 ? (
              <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-500">
                No products with stock. Add some on the Products tab first.
              </p>
            ) : (
              <ul className="space-y-2">
                {products.map((p) => {
                  const n = qty[p.id] ?? 0;
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 p-3"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="text-xs text-slate-500">
                          {inr(p.price)} · {p.stock} left
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => bump(p, -1)}
                          className="h-9 w-9 rounded-xl bg-slate-800 text-lg active:bg-slate-700"
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-semibold">{n}</span>
                        <button
                          onClick={() => bump(p, 1)}
                          className="h-9 w-9 rounded-xl bg-slate-800 text-lg active:bg-slate-700"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {err && (
              <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
                {err}
              </p>
            )}

            <button
              onClick={create}
              disabled={busy || lines.length === 0}
              className="mt-5 w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-slate-950 active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? "Creating..." : `Create order · ${inr(total)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}