"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRow } from "@/types/domain";

/**
 * Notification centre (PRD §50).
 *
 * Loads from PostgreSQL, then subscribes to Realtime for live inserts. The
 * database stays the source of truth: a dropped socket only costs freshness,
 * never correctness (PRD §53).
 */
export function NotificationBell({ locale }: { locale: "id" | "en" }) {
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, user_id, hotel_id, type, title, body, link, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (active && data) setItems(data as NotificationRow[]);
    };

    void load();

    const channel = supabase
      .channel("notifications-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as unknown as NotificationRow;
          setItems((all) => [row, ...all].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((i) => !i.is_read).length;

  const markAllRead = async () => {
    const supabase = createClient();
    const ids = items.filter((i) => !i.is_read).map((i) => i.id);
    if (ids.length === 0) return;
    setItems((all) => all.map((i) => ({ ...i, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", ids);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-text-muted transition hover:bg-bg-subtle hover:text-text"
        aria-label={locale === "id" ? "Notifikasi" : "Notifications"}
      >
        <Bell size={16} />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-xs font-semibold text-text">
              {locale === "id" ? "Notifikasi" : "Notifications"}
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                {locale === "id" ? "Tandai dibaca" : "Mark all read"}
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-text-faint">
                {locale === "id" ? "Tidak ada notifikasi" : "No notifications"}
              </p>
            ) : (
              items.map((n) => {
                const content = (
                  <div
                    className={`border-b border-border px-4 py-3 transition hover:bg-bg-subtle ${
                      n.is_read ? "" : "bg-primary-soft/40"
                    }`}
                  >
                    <p className="text-xs font-semibold text-text">{n.title}</p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">{n.body}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-text-faint">
                      {new Date(n.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
