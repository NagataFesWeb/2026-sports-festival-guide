"use client";

// ロード画面が閉じるまでヒーロー演出を待ち、画面に入ったカードだけ登場させる。
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSiteMotion } from "@/components/SiteMotion";

const IntroContext = createContext({ introReady: true, finishIntro: () => {} });
export const useIntro = () => useContext(IntroContext);

export function HomeExperience({ children }: { children: ReactNode }) {
  const [introReady, setIntroReady] = useState(false);
  const finishIntro = useCallback(() => setIntroReady(true), []);
  const ref = useRef<HTMLDivElement>(null);
  const { enabled, ready } = useSiteMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root || !ready || !introReady) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.revealState = "visible";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    const prepare = () => {
      for (const el of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
        if (!enabled) { el.dataset.revealState = "visible"; continue; }
        // 開発時のEffect再実行でも待機中のカードを再度監視する。
        if (el.dataset.revealState === "visible") continue;
        el.dataset.revealState = "pending";
        observer.observe(el);
      }
    };
    prepare();
    // サーバーから後で届くプログラムにも同じ演出を付ける。
    const mutations = new MutationObserver(prepare);
    mutations.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [enabled, ready, introReady]);

  return <IntroContext.Provider value={{ introReady, finishIntro }}><div ref={ref}>{children}</div></IntroContext.Provider>;
}
