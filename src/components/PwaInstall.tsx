"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PwaInstall() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [ios, setIos] = useState(false);
  const [closed, setClosed] = useState(true);
  useEffect(() => {
    const initialize = setTimeout(() => {
      setClosed(
        localStorage.getItem("efu:pwa-dismissed") === "1" ||
          localStorage.getItem("valoris:pwa-dismissed") === "1",
      );
      const standalone =
        matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    }, 0);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Prompt);
    };
    addEventListener("beforeinstallprompt", capture);
    return () => {
      clearTimeout(initialize);
      removeEventListener("beforeinstallprompt", capture);
    };
  }, []);
  if (pathname !== "/" || closed || (!ios && !prompt)) return null;
  return (
    <aside className="install">
      <div>
        <strong>
          {ios ? "ADD ENFUSION UNIVERSITY TO IPHONE" : "INSTALL ENFUSION UNIVERSITY"}
        </strong>
        <span>
          {ios
            ? "Safari → Share → Add to Home Screen"
            : "Install from the gateway; it will never cover academic work."}
        </span>
      </div>
      {prompt && (
        <button
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          }}
        >
          INSTALL
        </button>
      )}
      <button
        aria-label="Dismiss installation prompt"
        onClick={() => {
          localStorage.setItem("efu:pwa-dismissed", "1");
          setClosed(true);
        }}
      >
        ×
      </button>
    </aside>
  );
}
