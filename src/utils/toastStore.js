// The visible toast lives outside React state on purpose. While it sat in
// the old single app context, every toast (show + auto-hide = two updates) re-rendered
// every screen and list that reads the context — measured at 120 RecipeCard
// and 160 pantry-row renders per toast with a full Saved / Pantry tab. Only
// <Toast/> subscribes now, so showing a message re-renders just that overlay.
let current = null;
const listeners = new Set();

export const toastStore = {
  get: () => current,
  set(next) {
    current = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
