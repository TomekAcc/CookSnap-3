import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "../storage/keys";
import { booleanCodec } from "../storage/codecs";
import { usePersistedState } from "../hooks/usePersistedState";

const AiConsentContext = createContext(null);

/**
 * One-time consent before a photo of the person's kitchen is sent to a third-party AI (Apple's guideline
 * 5.1.2(i) expects explicit permission). `requestAiConsent()` resolves true at once when it was already given,
 * otherwise it shows the sheet and resolves with the answer; agreeing is remembered. Nothing is asked for the
 * sample scan, which sends no photo anywhere. The sheet itself is `AiConsentSheet`, mounted once in the app root
 * (this file stays free of UI so the providers can be used in tests without the animation libraries).
 */
export function AiConsentProvider({ children }) {
  const [accepted, setAccepted, hydrated] = usePersistedState(STORAGE_KEYS.aiConsent, {
    initial: false,
    codec: booleanCodec,
  });
  const [open, setOpen] = useState(false);

  // Read inside callbacks that outlive a render.
  const acceptedRef = useRef(accepted);
  acceptedRef.current = accepted;
  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;
  const hydrationWaiters = useRef([]);
  const pending = useRef(null); // { promise, resolve } while the sheet is up

  // A tap in the first moments after launch must not ask again about something already agreed to.
  useEffect(() => {
    if (!hydrated) return;
    hydrationWaiters.current.splice(0).forEach((wake) => wake());
  }, [hydrated]);

  const requestAiConsent = useCallback(async () => {
    if (!hydratedRef.current) await new Promise((wake) => hydrationWaiters.current.push(wake));
    if (acceptedRef.current) return true;
    if (pending.current) return pending.current.promise;
    let resolve;
    const promise = new Promise((r) => {
      resolve = r;
    });
    pending.current = { promise, resolve };
    setOpen(true);
    return promise;
  }, []);

  const settle = useCallback(
    (agreed) => {
      if (agreed) {
        acceptedRef.current = true;
        setAccepted(true);
      }
      setOpen(false);
      const current = pending.current;
      pending.current = null;
      current?.resolve(agreed);
    },
    [setAccepted]
  );

  // Settings switch: the person takes the consent back, so the next scan asks again.
  const withdrawAiConsent = useCallback(() => {
    acceptedRef.current = false;
    setAccepted(false);
  }, [setAccepted]);

  const value = useMemo(
    () => ({
      aiConsentAccepted: accepted,
      requestAiConsent,
      consentSheetOpen: open,
      answerAiConsent: settle,
      withdrawAiConsent,
    }),
    [accepted, requestAiConsent, open, settle, withdrawAiConsent]
  );

  return <AiConsentContext.Provider value={value}>{children}</AiConsentContext.Provider>;
}

export function useAiConsent() {
  const ctx = useContext(AiConsentContext);
  if (!ctx) throw new Error("useAiConsent must be used inside AiConsentProvider");
  return ctx;
}
