import type { Timestamp } from "firebase/firestore";

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// New server timestamps are briefly empty until Firestore confirms them
export function formatWhen(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== "function") return "just now";
  return ts.toDate().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}