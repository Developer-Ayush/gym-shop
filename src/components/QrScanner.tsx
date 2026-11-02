"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onScanRef = useRef(onScan);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Always call the newest onScan without restarting the camera
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Each start gets its own element, so React's double-run in development can't clash
    const el = document.createElement("div");
    el.id = `qr-${Math.random().toString(36).slice(2)}`;
    host.appendChild(el);

    const scanner = new Html5Qrcode(el.id);
    const config = { fps: 10, qrbox: { width: 240, height: 240 } };
    const onDecode = (text: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      onScanRef.current(text);
    };

    const started = scanner
      .start({ facingMode: "environment" }, config, onDecode, () => {})
      // Laptops usually have only a front camera
      .catch(() => scanner.start({ facingMode: "user" }, config, onDecode, () => {}))
      .catch((e: unknown) => {
        console.error(e);
        setError("Could not open the camera. Allow camera access in the browser and try again.");
      });

    return () => {
      started
        .then(() => scanner.stop())
        .then(() => scanner.clear())
        .catch(() => {})
        .finally(() => el.remove());
    };
  }, []);

  return (
    <div>
      <div
        ref={hostRef}
        className="min-h-64 overflow-hidden rounded-2xl bg-slate-900 [&_video]:w-full"
      />
      {error && (
        <p className="mt-4 rounded-xl border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}