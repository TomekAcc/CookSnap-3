import { useEffect } from "react";
import { AppState } from "react-native";
import { flushFeedbackOutbox } from "../services/feedbackOutbox";

/** Sends feedback messages that are still waiting: shortly after launch, and whenever the app returns to the front. */
export function useFeedbackOutbox() {
  useEffect(() => {
    const flush = () => {
      flushFeedbackOutbox().catch(() => {});
    };
    const timer = setTimeout(flush, 4000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") flush();
    });
    return () => {
      clearTimeout(timer);
      sub?.remove?.();
    };
  }, []);
}
