"use client";

import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./FacultyMessages.module.css";

type Message = {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
  optimistic?: boolean;
};
type Conversation = {
  id: string;
  subject: string;
  muted: boolean;
  lastReadByStudentAt: string | null;
  lastMessageAt: string;
  facultyProfile: {
    name: string;
    title: string;
    initials: string;
    academy: string | null;
    specialty: string;
    biography: string;
    teachingPhilosophy: string;
    availability: string;
  };
  course: { code: string; title: string } | null;
  messages: Message[];
  replyJobs: {
    id: string;
    status: string;
    attempt: number;
    maxAttempts: number;
    availableAt: string;
    lastError: string | null;
    supportRequestedAt: string | null;
  }[];
};
type MessagesData = {
  conversations: Conversation[];
  unread: number;
  supportProfile: {
    outreachEnabled: boolean;
    quietHoursStart: number;
    quietHoursEnd: number;
  };
};

export function FacultyMessages({
  initialConversationId,
}: { initialConversationId?: string } = {}) {
  const [data, setData] = useState<MessagesData | null>(null);
  const [selectedId, setSelectedId] = useState(initialConversationId || "");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const acceptPayload = useCallback((result: MessagesData) => {
    setData(result);
    setSelectedId((current) => current || result.conversations[0]?.id || "");
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/university/messages", {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (response.ok) acceptPayload(result);
    else setNotice(result.error);
  }, [acceptPayload]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void load().catch(() => {
        if (active)
          setNotice(
            "Campus Messages is reconnecting. Your conversation is preserved.",
          );
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!data?.conversations.some((item) => item.replyJobs.length)) return;
    const processing = data.conversations.some((item) =>
      item.replyJobs.some((job) => job.status === "PROCESSING"),
    );
    const timer = setInterval(
      () =>
        void load().catch(() =>
          setNotice(
            "Campus Messages is reconnecting. Your conversation is preserved.",
          ),
        ),
      processing ? 2000 : 5000,
    );
    return () => clearInterval(timer);
  }, [data, load]);

  const selected = useMemo(
    () => data?.conversations.find((item) => item.id === selectedId) || null,
    [data, selectedId],
  );
  const selectedConversationId = selected?.id;
  useEffect(() => {
    if (!selectedConversationId) return;
    void fetch("/api/university/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "read",
        conversationId: selectedConversationId,
      }),
    });
  }, [selectedConversationId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || message.trim().length < 2) return;
    const body = message.trim();
    const clientMessageId = crypto.randomUUID().replaceAll("-", "");
    setBusy(true);
    setNotice(
      "Message received by Campus Messages. Your faculty response is being prepared.",
    );
    setMessage("");
    setData((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((conversation) =>
              conversation.id === selected.id
                ? {
                    ...conversation,
                    messages: [
                      ...conversation.messages,
                      {
                        id: clientMessageId,
                        senderRole: "STUDENT",
                        body,
                        createdAt: new Date().toISOString(),
                        optimistic: true,
                      },
                    ],
                    replyJobs: [
                      ...conversation.replyJobs,
                      {
                        id: `pending-${clientMessageId}`,
                        status: "QUEUED",
                        attempt: 0,
                        maxAttempts: 3,
                        availableAt: new Date().toISOString(),
                        lastError: null,
                        supportRequestedAt: null,
                      },
                    ],
                  }
                : conversation,
            ),
          }
        : current,
    );
    try {
      const response = await fetch("/api/university/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "send",
          conversationId: selected.id,
          message: body,
          clientMessageId,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Message could not be sent");
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Message could not be sent. Retry when your connection returns.",
      );
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function jobAction(action: "retry" | "support", jobId: string) {
    if (!selected) return;
    setNotice(
      action === "retry"
        ? "The response was returned to the faculty queue."
        : "A support request was opened.",
    );
    try {
      const response = await fetch("/api/university/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, conversationId: selected.id, jobId }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    }
  }

  async function toggleMute() {
    if (!selected) return;
    await fetch("/api/university/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "mute",
        conversationId: selected.id,
        muted: !selected.muted,
      }),
    });
    await load();
  }

  if (!data)
    return <div className={styles.loading}>OPENING CAMPUS MESSAGES</div>;
  return (
    <section className={styles.messages}>
      <header className={styles.hero}>
        <div>
          <small>FACULTY COMMONS / CAMPUS MESSAGES</small>
          <h1>Your academic conversations</h1>
          <p>
            Your advisor and course faculty share the academic context needed to
            keep guidance consistent across the university.
          </p>
        </div>
        <aside>
          <b>{data.unread}</b>
          <span>
            unread faculty {data.unread === 1 ? "message" : "messages"}
          </span>
        </aside>
      </header>
      {notice && <p className={styles.notice}>{notice}</p>}
      <div className={styles.workspace}>
        <nav aria-label="Faculty conversations">
          {data.conversations.map((conversation) => (
            <button
              className={conversation.id === selectedId ? styles.active : ""}
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
            >
              <i>{conversation.facultyProfile.initials}</i>
              <span>
                <small>{conversation.course?.code || "ACADEMIC ADVISOR"}</small>
                <b>{conversation.facultyProfile.name}</b>
                <em>{conversation.subject}</em>
              </span>
              {conversation.replyJobs.some((job) =>
                ["QUEUED", "PROCESSING"].includes(job.status),
              ) && <strong>REPLYING</strong>}
            </button>
          ))}
        </nav>
        <AnimatePresence mode="wait">
          {selected && (
            <motion.article
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <header>
                <div className={styles.facultyMark}>
                  {selected.facultyProfile.initials}
                  <i />
                </div>
                <div>
                  <small>
                    {selected.facultyProfile.academy || "UNIVERSITY ADVISING"}
                  </small>
                  <h2>{selected.facultyProfile.name}</h2>
                  <p>
                    {selected.facultyProfile.title} ·{" "}
                    {selected.facultyProfile.availability}
                  </p>
                </div>
                <button onClick={toggleMute}>
                  {selected.muted ? "ENABLE CHECK-INS" : "MUTE CHECK-INS"}
                </button>
              </header>
              <div className={styles.facultyStatement}>
                <p>{selected.facultyProfile.biography}</p>
                <blockquote>
                  “{selected.facultyProfile.teachingPhilosophy}”
                </blockquote>
              </div>
              <div className={styles.thread}>
                {selected.messages.map((item) => (
                  <div
                    className={
                      item.senderRole === "STUDENT"
                        ? styles.student
                        : styles.faculty
                    }
                    key={item.id}
                  >
                    <small>
                      {item.senderRole === "STUDENT"
                        ? "YOU"
                        : item.senderRole === "SYSTEM"
                          ? "CAMPUS SUPPORT"
                          : selected.facultyProfile.name}
                    </small>
                    <p>{item.body}</p>
                    <time>
                      {item.optimistic
                        ? "Sending securely…"
                        : new Date(item.createdAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                    </time>
                  </div>
                ))}
                {selected.replyJobs
                  .filter((job) =>
                    [
                      "QUEUED",
                      "PROCESSING",
                      "WAITING_FOR_CONSENT",
                      "EXCEPTION",
                    ].includes(job.status),
                  )
                  .map((job) => (
                    <div className={styles.preparing} key={job.id}>
                      <i />
                      <span>
                        {job.status === "QUEUED"
                          ? job.attempt > 0
                            ? `Reply retry ${job.attempt} of ${job.maxAttempts} is scheduled`
                            : "Your message is queued for a faculty reply"
                          : job.status === "PROCESSING"
                            ? `${selected.facultyProfile.name} is preparing a reply`
                            : job.status === "WAITING_FOR_CONSENT"
                              ? "Open Policies & Agreements to continue this reply"
                              : "This response needs support"}
                        {job.status === "EXCEPTION" && (
                          <>
                            <button
                              onClick={() => void jobAction("retry", job.id)}
                            >
                              Retry response
                            </button>
                            <button
                              onClick={() => void jobAction("support", job.id)}
                              disabled={Boolean(job.supportRequestedAt)}
                            >
                              {job.supportRequestedAt
                                ? "Support requested"
                                : "Request support"}
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
              <form onSubmit={send}>
                <label htmlFor="faculty-message">
                  MESSAGE {selected.facultyProfile.name.toUpperCase()}
                </label>
                <textarea
                  id="faculty-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={2400}
                  placeholder="Share a question, blocker, goal, or update…"
                />
                <div>
                  <span>{message.length} / 2400</span>
                  <button disabled={busy || message.trim().length < 2}>
                    {busy ? "SENDING…" : "SEND MESSAGE →"}
                  </button>
                </div>
              </form>
            </motion.article>
          )}
        </AnimatePresence>
      </div>
      <footer>
        <p>
          Faculty communications are part of your academic support record.
          Automated academic communication practices are explained in university
          policy.
        </p>
        <a href="/university?view=profile#institutional-policy">
          VIEW INSTITUTIONAL POLICY
        </a>
      </footer>
    </section>
  );
}
