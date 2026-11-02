import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { randomTokenHex, sha256Hex } from "@/lib/crypto";
import type { ClaimResult, Order, OrderItem, Product, ProductInput } from "@/types";

const productsCol = () => collection(db, "products");
const ordersCol = () => collection(db, "orders");

export function errorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "permission-denied") {
    return "Not allowed. Check that this account has the shopkeeper role and the rules are published.";
  }
  if (err?.code === "unavailable") return "No connection. Check your internet and try again.";
  return err?.message ?? "Something went wrong.";
}

/* ------------------------------ Products ------------------------------ */

export function subscribeProducts(
  onData: (products: Product[]) => void,
  onError: (e: Error) => void
) {
  const q = query(productsCol(), orderBy("name"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)),
    onError
  );
}

export async function addProduct(input: ProductInput) {
  await addDoc(productsCol(), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(
  id: string,
  patch: Pick<Product, "name" | "category" | "price" | "active" | "imageData">
) {
  await updateDoc(doc(db, "products", id), { ...patch, updatedAt: serverTimestamp() });
}

// Add (positive) or remove (negative) units
export async function changeStock(id: string, delta: number) {
  await updateDoc(doc(db, "products", id), {
    stock: increment(delta),
    updatedAt: serverTimestamp(),
  });
}

export async function setStock(id: string, stock: number) {
  await updateDoc(doc(db, "products", id), { stock, updatedAt: serverTimestamp() });
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(db, "products", id));
}

/* ------------------------------- Orders ------------------------------- */

export function subscribeOrders(
  onData: (orders: Order[]) => void,
  onError: (e: Error) => void,
  max = 30
) {
  const q = query(ordersCol(), orderBy("createdAt", "desc"), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    onError
  );
}

/*
  CLAIM: shopkeeper enters the invoice ID and scans the QR (which holds the secret token).
  Inside one transaction we check the token and flip ordered -> delivered.
  A second attempt finds "delivered" and is rejected.

  NOTE: for now this check runs in the app. When we add Cloud Functions, the same logic
  moves into a function so verification truly happens on the backend.
*/
export async function claimOrder(
  invoiceIdRaw: string,
  tokenRaw: string,
  shopkeeperUid: string
): Promise<ClaimResult> {
  const invoiceId = invoiceIdRaw.trim();
  const token = tokenRaw.trim().toLowerCase();

  if (!/^\d{7,8}$/.test(invoiceId)) {
    return { ok: false, reason: "not_found", message: "Invoice ID must be 7 or 8 digits." };
  }
  if (!token) {
    return { ok: false, reason: "invalid_token", message: "Scan the QR code on the invoice." };
  }

  const found = await getDocs(query(ordersCol(), where("invoiceId", "==", invoiceId), limit(1)));
  if (found.empty) {
    return { ok: false, reason: "not_found", message: "No order found with this invoice ID." };
  }

  const ref = found.docs[0].ref;
  const tokenHash = await sha256Hex(token);

  return runTransaction(db, async (tx): Promise<ClaimResult> => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      return { ok: false, reason: "not_found", message: "No order found with this invoice ID." };
    }
    const order = { id: snap.id, ...snap.data() } as Order;

    if (order.status === "delivered") {
      return { ok: false, reason: "already_delivered", message: "This order was already delivered." };
    }
    if (order.status === "cancelled") {
      return { ok: false, reason: "cancelled", message: "This order was cancelled." };
    }
    if (order.status !== "ordered") {
      return { ok: false, reason: "not_ready", message: "This order is not ready to claim." };
    }
    if (order.claimTokenHash !== tokenHash) {
      return { ok: false, reason: "invalid_token", message: "The QR code does not match this invoice." };
    }

    tx.update(ref, {
      status: "delivered",
      deliveredAt: serverTimestamp(),
      deliveredBy: shopkeeperUid,
    });
    return { ok: true, order: { ...order, status: "delivered" } };
  });
}

/*
  DEV ONLY: creates a fake order like a member purchase would:
  reserves stock, takes the next serial invoice number, stores only the token hash.
  Returns the raw token so we can show it as a QR for testing.
*/
export async function createTestOrder(
  items: { productId: string; qty: number }[],
  buyerName: string
): Promise<{ invoiceId: string; token: string; total: number }> {
  const token = randomTokenHex(32);
  const claimTokenHash = await sha256Hex(token);
  const counterRef = doc(db, "counters", "invoice");
  const orderRef = doc(ordersCol());

  return runTransaction(db, async (tx) => {
    // All reads first
    const counterSnap = await tx.get(counterRef);
    const productSnaps = await Promise.all(
      items.map((i) => tx.get(doc(db, "products", i.productId)))
    );

    const next: number = counterSnap.exists() ? (counterSnap.data().next as number) : 1000001;
    const orderItems: OrderItem[] = [];
    let total = 0;

    productSnaps.forEach((ps, idx) => {
      const qty = items[idx].qty;
      if (!ps.exists()) throw new Error("A product in this order no longer exists.");
      const p = ps.data() as Omit<Product, "id">;
      if (qty < 1) throw new Error("Quantity must be at least 1.");
      if (p.stock < qty) throw new Error(`Not enough stock for ${p.name}.`);
      orderItems.push({ productId: ps.id, name: p.name, qty, price: p.price });
      total += p.price * qty;
    });

    // Then writes
    productSnaps.forEach((ps, idx) => {
      tx.update(ps.ref, {
        stock: increment(-items[idx].qty),
        updatedAt: serverTimestamp(),
      });
    });
    tx.set(counterRef, { next: next + 1 });
    tx.set(orderRef, {
      uid: "test-buyer",
      buyerName,
      invoiceId: String(next),
      items: orderItems,
      total,
      status: "ordered",
      claimTokenHash,
      createdAt: serverTimestamp(),
      deliveredAt: null,
      deliveredBy: null,
    });

    return { invoiceId: String(next), token, total };
  });
}