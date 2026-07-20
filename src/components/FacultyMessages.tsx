"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./FacultyMessages.module.css";
import { AcademicLoader } from "./AcademicLoader";
import { ArrowRight, MessageCircle, Search, Users } from "lucide-react";

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
  directory: {
    id: string;
    slug: string;
    name: string;
    title: string;
    initials: string;
    academy: string | null;
    specialty: string;
    biography: string;
    availability: string;
    isPrimaryAdvisor: boolean;
    conversationId: string | null;
  }[];
  unread: number;
  supportProfile: {
    outreachEnabled: boolean;
    quietHoursStart: number;
    quietHoursEnd: number;
  };
};
type PolicyGate = {
  policyGateUrl: string;
  missingPolicyVersions: {
    id: string;
    title: string;
    version: number;
  }[];
};

export function FacultyMessages({
  initialConversationId,
  initialFacultySlug,
}: { initialConversationId?: string; initialFacultySlug?: string } = {}) {
  const [data, setData] = useState<MessagesData | null>(null);
  const [selectedId, setSelectedId] = useState(initialConversationId || "");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");
  const [policyGate, setPolicyGate] = useState<PolicyGate | null>(null);
  const hasLoaded = useRef(false);
  const requestedFacultyHandled = useRef("");

  const acceptPayload = useCallback((result: MessagesData) => {
    setData(result);
    setPolicyGate(null);
    setLoadError("");
    hasLoaded.current = true;
    setSelectedId((current) => current || result.conversations[0]?.id || "");
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/university/messages", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => ({}));
      if (
        response.status === 428 &&
        result.code === "POLICY_ACCEPTANCE_REQUIRED"
      ) {
        setPolicyGate({
          policyGateUrl: result.policyGateUrl || "/policies/accept",
          missingPolicyVersions: result.missingPolicyVersions || [],
        });
        setLoadError("");
        return;
      }
      if (!response.ok)
        throw new Error(result.error || "Campus Messages could not be opened.");
      acceptPayload(result);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "Campus Messages could not be opened.";
      if (hasLoaded.current) {
        setNotice(
          "Campus Messages is reconnecting. Your conversation is preserved.",
        );
      } else {
        setLoadError(detail);
      }
    }
  }, [acceptPayload]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    const activeJobs = data?.conversations.flatMap((item) =>
      item.replyJobs.filter((job) =>
        ["QUEUED", "PROCESSING"].includes(job.status),
      ),
    );
    if (!activeJobs?.length || policyGate) return;
    const processing = activeJobs.some((job) => job.status === "PROCESSING");
    const timer = setInterval(
      () => void load(),
      processing ? 2000 : 5000,
    );
    return () => clearInterval(timer);
  }, [data, load, policyGate]);

  const selected = useMemo(
    () => data?.conversations.find((item) => item.id === selectedId) || null,
    [data, selectedId],
  );
  const filteredDirectory = useMemo(() => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return data?.directory || [];
    return (data?.directory || []).filter((faculty) =>
      `${faculty.name} ${faculty.title} ${faculty.academy || ""} ${faculty.specialty}`
        .toLowerCase()
        .includes(query),
    );
  }, [data?.directory, directorySearch]);

  const openFaculty = useCallback(
    async (facultyProfileId: string, existingConversationId?: string | null) => {
      if (existingConversationId) {
        setSelectedId(existingConversationId);
        document.getElementById("faculty-conversation")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }
      setNotice("Opening the faculty office…");
      try {
        const response = await fetch("/api/university/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start", facultyProfileId }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.error || "The faculty office could not be opened.");
        await load();
        setSelectedId(result.conversationId);
        setNotice("");
        window.history.replaceState(null, "", "/university?view=messages");
        requestAnimationFrame(() =>
          document.getElementById("faculty-conversation")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        );
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "The faculty office could not be opened.",
        );
      }
    },
    [load],
  );

  useEffect(() => {
    if (!data?.directory.length) return;
    const slug =
      initialFacultySlug ||
      new URLSearchParams(window.location.search).get("faculty");
    if (!slug) return;
    if (requestedFacultyHandled.current === slug) return;
    const faculty = data.directory.find((item) => item.slug === slug);
    requestedFacultyHandled.current = slug;
    if (!faculty) return;
    const timer = setTimeout(
      () => void openFaculty(faculty.id, faculty.conversationId),
      0,
    );
    return () => clearTimeout(timer);
  }, [data?.directory, initialFacultySlug, openFaculty]);
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

  if (policyGate) {
    const returnTo = encodeURIComponent("/university?view=messages");
    const gateUrl = `${policyGate.policyGateUrl}?returnTo=${returnTo}`;
    return (
      <section className={styles.consentGate} role="alert" aria-live="polite">
        <small>CAMPUS MESSAGES / SIGNATURE REQUIRED</small>
        <h1>Review the current policies to open your conversations.</h1>
        <p>
          Your messages and pending faculty replies are preserved. University
          policy changed after your last signature, so Campus Messages is paused
          until the current bundle is electronically signed.
        </p>
        {!!policyGate.missingPolicyVersions.length && (
          <div>
            <b>Updated documents awaiting your signature</b>
            <ul>
              {policyGate.missingPolicyVersions.map((policy) => (
                <li key={policy.id}>
                  {policy.title} <span>Version {policy.version}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <a href={gateUrl}>REVIEW AND SIGN POLICIES →</a>
        <button type="button" onClick={() => void load()}>
          I HAVE ALREADY SIGNED — CHECK AGAIN
        </button>
      </section>
    );
  }
  if (!data && loadError)
    return (
      <section className={styles.loadFailure} role="alert">
        <small>CAMPUS MESSAGES / CONNECTION NOTICE</small>
        <h1>Messages did not finish opening.</h1>
        <p>{loadError}</p>
        <p>Your conversation record has not been changed.</p>
        <button type="button" onClick={() => void load()}>
          RETRY CAMPUS MESSAGES
        </button>
      </section>
    );
  if (!data) return <AcademicLoader label="Opening campus messages" />;
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
      <section className={styles.facultyDirectory} aria-labelledby="faculty-directory-title">
        <header>
          <div>
            <small>UNIVERSITY FACULTY DIRECTORY</small>
            <h2 id="faculty-directory-title">Find the right person to ask.</h2>
            <p>
              Contact your advisor, a subject professor, Admissions, Academic
              Records, Sponsored Learning, or the Dean’s office.
            </p>
          </div>
          <label>
            <Search size={17} />
            <span className="sr-only">Search faculty</span>
            <input
              value={directorySearch}
              onChange={(event) => setDirectorySearch(event.target.value)}
              placeholder="Search by name, office, or specialty"
            />
          </label>
        </header>
        <div className={styles.directoryGrid}>
          {filteredDirectory.map((faculty, index) => (
            <motion.button
              key={faculty.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.035 }}
              onClick={() => void openFaculty(faculty.id, faculty.conversationId)}
            >
              <i>{faculty.initials}</i>
              <span>
                <small>{faculty.academy || "University Office"}</small>
                <b>{faculty.name}</b>
                <em>{faculty.title}</em>
                <p>{faculty.specialty}</p>
              </span>
              <strong>
                <MessageCircle size={15} />
                {faculty.conversationId ? "Open" : "Message"}
              </strong>
              <ArrowRight size={16} />
            </motion.button>
          ))}
          {!filteredDirectory.length && (
            <div className={styles.directoryEmpty}>
              <Users size={22} /> No faculty match that search.
            </div>
          )}
        </div>
      </section>
      <div className={styles.workspace} id="faculty-conversation">
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
                          ? job.lastError?.startsWith("RATE_LIMITED:")
                            ? `Campus messaging is temporarily at capacity. Your message is safe and will retry automatically${job.availableAt ? ` after ${new Date(job.availableAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.`
                            : job.attempt > 0
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
