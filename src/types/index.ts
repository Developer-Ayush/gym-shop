import type { Timestamp } from "firebase/firestore";

export type Role = "member" | "manager" | "trainer" | "shopkeeper" | "developer";

export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
  createdAt: Timestamp;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number; // rupees
  stock: number;
  active: boolean;
  imageData: string | null; // small compressed photo stored as a data URL
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ProductInput = Pick<
  Product,
  "name" | "category" | "price" | "stock" | "active" | "imageData"
>;

export type OrderStatus = "ordered" | "delivered" | "cancelled";

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  uid: string; // buyer
  buyerName: string;
  invoiceId: string; // 7-8 digit serial
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  claimTokenHash: string; // SHA-256 of the secret token in the invoice QR
  createdAt: Timestamp;
  deliveredAt: Timestamp | null;
  deliveredBy: string | null;
}

export type ClaimFailReason =
  | "not_found"
  | "invalid_token"
  | "already_delivered"
  | "cancelled"
  | "not_ready";

export type ClaimResult =
  | { ok: true; order: Order }
  | { ok: false; reason: ClaimFailReason; message: string };