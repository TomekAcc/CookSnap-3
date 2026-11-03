import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ModalProvider } from "../src/context/ModalContext";
import { AppProviders } from "../src/context/AppProviders";
import { useAiConsent } from "../src/context/AiConsentContext";
import { useScanCapture } from "../src/components/scanner/useScanCapture";

jest.mock("expo-camera", () => ({ useCameraPermissions: jest.fn() }));
jest.mock("../src/utils/imagePicker", () => ({ pickImageFromLibrary: jest.fn() }));
jest.setTimeout(30000);
const { useCameraPermissions } = require("expo-camera");

const KEY = "cooksnap:aiConsent:v1";
const wrapper = ({ children }) => (
  <ModalProvider>
    <AppProviders>{children}</AppProviders>
  </ModalProvider>
);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  useCameraPermissions.mockReturnValue([{ granted: true }, jest.fn()]);
});

async function mountConsent() {
  const utils = renderHook(() => useAiConsent(), { wrapper });
  await act(async () => {});
  return utils;
}

describe("AiConsentContext", () => {
  it("resolves true at once, without the sheet, when consent was already given", async () => {
    await AsyncStorage.setItem(KEY, "true");
    const { result } = await mountConsent();
    let answer;
    await act(async () => {
      answer = await result.current.requestAiConsent();
    });
    expect(answer).toBe(true);
    expect(result.current.consentSheetOpen).toBe(false);
  });

  it("opens the sheet and waits for an answer when nothing was agreed yet", async () => {
    const { result } = await mountConsent();
    let settled = null;
    act(() => {
      result.current.requestAiConsent().then((v) => (settled = v));
    });
    await waitFor(() => expect(result.current.consentSheetOpen).toBe(true));
    expect(settled).toBeNull();
    await act(async () => result.current.answerAiConsent(true));
    expect(settled).toBe(true);
    expect(result.current.consentSheetOpen).toBe(false);
    await waitFor(async () => expect(await AsyncStorage.getItem(KEY)).toBe("true"));
  });

  it("does not remember a refusal, so the next try asks again", async () => {
    const { result } = await mountConsent();
    let settled = null;
    act(() => {
      result.current.requestAiConsent().then((v) => (settled = v));
    });
    await waitFor(() => expect(result.current.consentSheetOpen).toBe(true));
    await act(async () => result.current.answerAiConsent(false));
    expect(settled).toBe(false);
    expect(await AsyncStorage.getItem(KEY)).not.toBe("true");

    act(() => {
      result.current.requestAiConsent();
    });
    await waitFor(() => expect(result.current.consentSheetOpen).toBe(true));
  });

  it("shares one sheet between two simultaneous requests", async () => {
    const { result } = await mountConsent();
    const answers = [];
    act(() => {
      result.current.requestAiConsent().then((v) => answers.push(v));
      result.current.requestAiConsent().then((v) => answers.push(v));
    });
    await waitFor(() => expect(result.current.consentSheetOpen).toBe(true));
    await act(async () => result.current.answerAiConsent(true));
    expect(answers).toEqual([true, true]);
  });
});

describe("scan capture is gated by consent", () => {
  it("does not open the camera when the person declines", async () => {
    const onPhoto = jest.fn();
    const { result } = renderHook(() => ({ cap: useScanCapture("fridge", onPhoto), consent: useAiConsent() }), {
      wrapper,
    });
    await act(async () => {});
    act(() => {
      result.current.cap.openCamera();
    });
    await waitFor(() => expect(result.current.consent.consentSheetOpen).toBe(true));
    expect(result.current.cap.camera.open).toBe(false);
    await act(async () => result.current.consent.answerAiConsent(false));
    expect(result.current.cap.camera.open).toBe(false);
  });

  it("opens the camera after the person agrees", async () => {
    const { result } = renderHook(() => ({ cap: useScanCapture("fridge", jest.fn()), consent: useAiConsent() }), {
      wrapper,
    });
    await act(async () => {});
    act(() => {
      result.current.cap.openCamera();
    });
    await waitFor(() => expect(result.current.consent.consentSheetOpen).toBe(true));
    await act(async () => result.current.consent.answerAiConsent(true));
    await waitFor(() => expect(result.current.cap.camera.open).toBe(true));
  });
});
