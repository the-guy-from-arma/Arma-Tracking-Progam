"use client";

import Link from "next/link";
import { Bell, Check, CheckCheck, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AccountAlerts.module.css";

type AlertItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

type AlertData = { notifications: AlertItem[]; unread: number };

function relativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

export function AccountAlerts({ weeklyAvailable }: { weeklyAvailable: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AlertData>({ notifications: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/university/notifications", {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return;
      setData(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(), 45_000);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function markRead(id: string) {
    setData((current) => ({
      unread: Math.max(0, current.unread - (current.notifications.find((item) => item.id === id)?.readAt ? 0 : 1)),
      notifications: current.notifications.map((item) => item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item),
    }));
    await fetch("/api/university/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }

  async function markAll() {
    setData((current) => ({
      unread: 0,
      notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })),
    }));
    await fetch("/api/university/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined);
  }

  return (
    <div className={styles.alertRoot} ref={root}>
      <button
        className={styles.alertTrigger}
        onClick={() => setOpen((value) => !value)}
        aria-label={`${data.unread} unread account alerts`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={18} aria-hidden="true" />
        <span>Alerts</span>
        {data.unread > 0 && <em>{data.unread > 99 ? "99+" : data.unread}</em>}
      </button>
      {open && (
        <section className={styles.alertTray} role="dialog" aria-label="Account alerts">
          <header>
            <div>
              <span>STUDENT ACCOUNT</span>
              <h2>Alerts</h2>
            </div>
            <button onClick={() => void markAll()} disabled={!data.unread}>
              <CheckCheck size={15} /> Mark all read
            </button>
          </header>
          <div className={styles.alertStream}>
            {data.notifications.slice(0, 10).map((item) => {
              const content = (
                <>
                  <i data-read={Boolean(item.readAt)}>{item.readAt ? <Check size={12} /> : null}</i>
                  <span>
                    <small>{item.type.replaceAll("_", " ")} · {relativeDate(item.createdAt)}</small>
                    <b>{item.title}</b>
                    <p>{item.body}</p>
                  </span>
                  <ChevronRight size={16} />
                </>
              );
              return item.actionUrl ? (
                <a key={item.id} href={item.actionUrl} onClick={() => void markRead(item.id)} className={!item.readAt ? styles.unread : ""}>
                  {content}
                </a>
              ) : (
                <button key={item.id} onClick={() => void markRead(item.id)} className={!item.readAt ? styles.unread : ""}>
                  {content}
                </button>
              );
            })}
            {!loading && !data.notifications.length && (
              <div className={styles.emptyAlerts}>
                <CheckCheck size={22} />
                <b>You are all caught up.</b>
                <span>Funding, academic, deadline, and faculty alerts will appear here.</span>
              </div>
            )}
            {loading && <div className={styles.loadingAlerts}>Checking your account record...</div>}
          </div>
          {weeklyAvailable && (
            <footer>
              <Link href="/university?view=notifications" onClick={() => setOpen(false)}>
                Read Enscript Development Weekly <ChevronRight size={16} />
              </Link>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}
