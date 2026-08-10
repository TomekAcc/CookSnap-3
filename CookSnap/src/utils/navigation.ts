import { router } from "expo-router";

export function closeModal() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}
