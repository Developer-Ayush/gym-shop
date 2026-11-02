"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addProduct,
  changeStock,
  deleteProduct,
  errorMessage,
  setStock,
  subscribeProducts,
  updateProduct,
} from "@/lib/shopApi";
import { fileToCompressedDataUrl } from "@/lib/image";
import type { Product } from "@/types";

const LOW_STOCK = 5;
const inputCls =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none focus:border-amber-500";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type SheetState =
  | { kind: "add" }
  | { kind: "edit"; product: Product }
  | { kind: "stock"; product: Product }
  | null;

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);

  useEffect(() => {
    const unsubscribe = subscribeProducts(
      (list) => {
        setProducts(list);
        setLoading(false);
      },
      (e) => {
        setError(errorMessage(e));
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s)
    );
  }, [products, search]);

  const lowCount = products.filter((p) => p.stock <= LOW_STOCK).length;

  return (
    <main className="px-5 pt-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-400">
            {products.length} items{lowCount > 0 && ` · ${lowCount} low on stock`}
          </p>
        </div>
        <button
          onClick={() => setSheet({ kind: "add" })}
          className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 active:scale-95"
        >
          + Add
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products"
        className={`${inputCls} mt-4`}
      />

      {error && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-slate-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">
          {products.length === 0 ? "No products yet. Tap + Add to create one." : "No matches."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((p) => {
            const low = p.stock <= LOW_STOCK;
            return (
              <li
                key={p.id}
                className={`rounded-3xl border border-slate-800 bg-slate-900 p-4 ${
                  p.active ? "" : "opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-800 text-2xl">
                    {p.imageData ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageData} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      "📦"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.category || "Uncategorised"}
                      {!p.active && " · Hidden"}
                    </p>
                    <p className="mt-1 font-bold">{inr(p.price)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.stock === 0
                        ? "bg-red-950 text-red-300"
                        : low
                        ? "bg-amber-950 text-amber-300"
                        : "bg-emerald-950 text-emerald-300"
                    }`}
                  >
                    {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSheet({ kind: "stock", product: p })}
                      className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold active:bg-slate-700"
                    >
                      Stock
                    </button>
                    <button
                      onClick={() => setSheet({ kind: "edit", product: p })}
                      className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold active:bg-slate-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sheet?.kind === "add" && <ProductSheet product={null} onClose={() => setSheet(null)} />}
      {sheet?.kind === "edit" && (
        <ProductSheet product={sheet.product} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "stock" && (
        <StockSheet product={sheet.product} onClose={() => setSheet(null)} />
      )}
    </main>
  );
}

/* ------------------------------ Shared shell ------------------------------ */

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-slate-800 bg-slate-900 p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="px-2 text-slate-400">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* --------------------------- Add / edit a product -------------------------- */

function ProductSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "Supplements");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStockText] = useState("0");
  const [active, setActive] = useState(product?.active ?? true);
  const [image, setImage] = useState<string | null>(product?.imageData ?? null);
  const [imgBusy, setImgBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets you pick the same file again later
    if (!file) return;
    setImgBusy(true);
    setErr(null);
    try {
      setImage(await fileToCompressedDataUrl(file));
    } catch (er) {
      setErr(errorMessage(er));
    }
    setImgBusy(false);
  }

  async function save() {
    const p = Number(price);
    const s = Number(stock);
    if (!name.trim()) return setErr("Enter a product name.");
    if (price.trim() === "" || !Number.isFinite(p) || p < 0) return setErr("Enter a valid price.");
    if (!product && (stock.trim() === "" || !Number.isInteger(s) || s < 0)) {
      return setErr("Stock must be a whole number, 0 or more.");
    }

    setBusy(true);
    setErr(null);
    try {
      if (product) {
        await updateProduct(product.id, {
          name: name.trim(),
          category: category.trim(),
          price: p,
          active,
          imageData: image,
        });
      } else {
        await addProduct({
          name: name.trim(),
          category: category.trim(),
          price: p,
          stock: s,
          active,
          imageData: image,
        });
      }
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!product) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteProduct(product.id);
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <SheetShell title={product ? "Edit product" : "Add product"} onClose={onClose}>
      <div className="space-y-3">
        {/* Photo */}
        <div>
          <label className="mb-1 block text-xs text-slate-400">Photo</label>
          <label className="flex h-44 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-black">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Product" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm text-slate-400">
                {imgBusy ? "Processing photo..." : "📷 Tap to add a photo"}
              </span>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          </label>
          {image && (
            <div className="mt-2 flex gap-4 text-xs">
              <span className="text-slate-500">Tap the photo to change it</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                className="font-semibold text-red-400"
              >
                Remove photo
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Whey Protein 1kg"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Supplements"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Price (₹)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="2499"
              className={inputCls}
            />
          </div>
          {!product && (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Starting stock</label>
              <input
                value={stock}
                onChange={(e) => setStockText(e.target.value)}
                inputMode="numeric"
                className={inputCls}
              />
            </div>
          )}
        </div>

        <label className="flex items-center justify-between rounded-xl border border-slate-700 px-4 py-3">
          <span className="text-sm">Visible to members</span>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-5 w-5 accent-amber-500"
          />
        </label>
      </div>

      {err && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {err}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy || imgBusy}
        className="mt-5 w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-slate-950 active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Saving..." : product ? "Save changes" : "Add product"}
      </button>

      {product && (
        <div className="mt-4">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="w-full rounded-2xl border border-red-900 py-3 text-sm font-semibold text-red-400 active:bg-red-950"
            >
              Delete product
            </button>
          ) : (
            <div className="rounded-2xl border border-red-900 bg-red-950/50 p-4">
              <p className="text-sm">
                Delete <b>{product.name}</b> permanently? Past orders keep their own copy of the name
                and price.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl bg-slate-800 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  Yes, delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SheetShell>
  );
}

/* ------------------------------ Change stock ------------------------------ */

function StockSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [mode, setMode] = useState<"add" | "reduce" | "set">("add");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const n = Number(qty);
  const valid = qty.trim() !== "" && Number.isInteger(n) && n >= 0;
  const newStock =
    mode === "add" ? product.stock + n : mode === "reduce" ? product.stock - n : n;
  const canSave = valid && newStock >= 0 && (mode === "set" || n > 0);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    try {
      if (mode === "add") await changeStock(product.id, n);
      else if (mode === "reduce") await changeStock(product.id, -n);
      else await setStock(product.id, n);
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  const modes = [
    { id: "add", label: "Restock (+)" },
    { id: "reduce", label: "Reduce (−)" },
    { id: "set", label: "Set exact" },
  ] as const;

  return (
    <SheetShell title="Change stock" onClose={onClose}>
      <p className="font-semibold">{product.name}</p>
      <p className="text-sm text-slate-400">Current stock: {product.stock}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-xl py-2.5 text-xs font-semibold ${
              mode === m.id ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        inputMode="numeric"
        placeholder={mode === "set" ? "New stock count" : "Quantity"}
        className={`${inputCls} mt-4`}
        autoFocus
      />

      {valid && (
        <p className={`mt-3 text-sm ${newStock < 0 ? "text-red-400" : "text-slate-400"}`}>
          {newStock < 0 ? "Cannot reduce below 0." : `New stock will be ${newStock}.`}
        </p>
      )}

      {err && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {err}
        </p>
      )}

      <button
        onClick={save}
        disabled={!canSave || busy}
        className="mt-5 w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-slate-950 active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "Saving..." : "Update stock"}
      </button>
    </SheetShell>
  );
}