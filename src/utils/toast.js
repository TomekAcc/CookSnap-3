import { toastStore } from "./toastStore";

// Plain functions, not context: showing a toast needs no React state, so any
// module (a context, a service callback, a component) can import and call
// these directly without subscribing to anything. <Toast/> reads toastStore.
let timer = null;

/** Show a message for `duration` ms. A newer toast replaces the one on screen. */
export function showToast(message, type = "info", duration = 3200) {
  if (timer) clearTimeout(timer);
  toastStore.set({ message, type });
  timer = setTimeout(() => toastStore.set(null), duration);
}

/** Tap / swipe-up dismiss from the Toast component. */
export function hideToast() {
  if (timer) clearTimeout(timer);
  toastStore.set(null);
}
