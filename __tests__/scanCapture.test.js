import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ModalProvider, useModalState } from "../src/context/ModalContext";
import { AppProviders } from "../src/context/AppProviders";
import { useScan } from "../src/context/ScanContext";
import { useEntitlements } from "../src/context/EntitlementsContext";
import { useScanCapture } from "../src/components/scanner/useScanCapture";
import { toastStore } from "../src/utils/toastStore";
import { hideToast } from "../src/utils/toast";

jest.mock("expo-camera", () => ({ useCameraPermissions: jest.fn() }));
jest.mock("../src/utils/imagePicker", () => ({ pickImageFromLibrary: jest.fn() }));
jest.mock("../src/services/geminiVision", () => ({
  ...jest.requireActual("../src/services/geminiVision"),
  analyzeFridgeImage: jest.fn(),
  analyzePantryImage: jest.fn(),
}));
jest.setTimeout(30000);
const { useCameraPermissions } = require("expo-camera");
const { pickImageFromLibrary } = require("../src/utils/imagePicker");

const wrapper = ({ children }) => (
  <ModalProvider>
    <AppProviders>{children}</AppProviders>
  </ModalProvider>
);

let onPhoto;
let requestPermission;

async function mount(kind) {
  const utils = renderHook(
    () => ({ cap: useScanCapture(kind, onPhoto), scan: useScan(), ent: useEntitlements(), modal: useModalState() }),
    { wrapper }
  );
  await waitFor(() => expect(utils.result.current.scan).toBeTruthy());
  await act(async () => {});
  return utils;
}

function setPermission(granted, requestResult = { granted: true }) {
  requestPermission = jest.fn().mockResolvedValue(requestResult);
  useCameraPermissions.mockReturnValue([{ granted }, requestPermission]);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  hideToast();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  onPhoto = jest.fn().mockResolvedValue(undefined);
  setPermission(true);
});
afterEach(() => {
  hideToast();
  console.warn.mockRestore();
});

describe.each([
  ["fridge", { open: (r) => r.scan.cameraOpen, reason: "scan", exhaust: (r) => { r.ent.registerFridgeScanAttempt(); r.ent.registerFridgeScanAttempt(); } }],
  ["pantry", { open: (r) => r.scan.pantryCameraOpen, reason: "pantryScan", exhaust: (r) => { r.ent.registerPantryScanAttempt(); r.ent.registerPantryScanAttempt(); } }],
])("useScanCapture (%s)", (kind, cfg) => {
  describe("openCamera", () => {
    it("opens the camera when permission is already granted", async () => {
      const { result } = await mount(kind);
      await act(() => result.current.cap.openCamera());
      expect(cfg.open(result.current)).toBe(true);
      expect(result.current.cap.camera.open).toBe(true);
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it("asks for permission first, and opens once it is given", async () => {
      setPermission(false, { granted: true });
      const { result } = await mount(kind);
      await act(() => result.current.cap.openCamera());
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(cfg.open(result.current)).toBe(true);
    });

    it("stays closed and says so when permission is refused", async () => {
      setPermission(false, { granted: false });
      const { result } = await mount(kind);
      await act(() => result.current.cap.openCamera());
      expect(cfg.open(result.current)).toBe(false);
      expect(toastStore.get()).toMatchObject({ type: "error" });
    });

    it("reports a failing permission request instead of throwing", async () => {
      setPermission(false);
      requestPermission.mockRejectedValue(new Error("native"));
      const { result } = await mount(kind);
      await act(() => result.current.cap.openCamera());
      expect(cfg.open(result.current)).toBe(false);
      expect(toastStore.get()).toMatchObject({ type: "error" });
    });

    it("shows the paywall (right reason) without asking for permission when the free limit is used", async () => {
      setPermission(false);
      const { result } = await mount(kind);
      act(() => cfg.exhaust(result.current));
      await act(() => result.current.cap.openCamera());
      expect(requestPermission).not.toHaveBeenCalled();
      expect(cfg.open(result.current)).toBe(false);
      expect(result.current.modal.proModalOpen).toBe(true);
      expect(result.current.modal.proReason).toBe(cfg.reason);
    });
  });

  describe("shutter", () => {
    const withCamera = async (takePictureAsync) => {
      const utils = await mount(kind);
      await act(() => utils.result.current.cap.openCamera());
      utils.result.current.cap.camera.cameraRef.current = { takePictureAsync };
      return utils;
    };

    it("takes the picture, closes the camera and hands the photo over", async () => {
      const take = jest.fn().mockResolvedValue({ uri: "file://shot.jpg" });
      const { result } = await withCamera(take);
      await act(() => result.current.cap.camera.onCapture());
      expect(take).toHaveBeenCalledWith({ quality: 0.85, imageType: "jpg" });
      expect(cfg.open(result.current)).toBe(false);
      expect(onPhoto).toHaveBeenCalledWith("file://shot.jpg", "camera");
    });

    it("closes the camera and reports a failed capture", async () => {
      const { result } = await withCamera(jest.fn().mockRejectedValue(new Error("boom")));
      await act(() => result.current.cap.camera.onCapture());
      expect(cfg.open(result.current)).toBe(false);
      expect(onPhoto).not.toHaveBeenCalled();
      expect(toastStore.get()).toMatchObject({ type: "error" });
    });

    it("does nothing before the camera view has mounted", async () => {
      const { result } = await mount(kind);
      await act(() => result.current.cap.camera.onCapture());
      expect(onPhoto).not.toHaveBeenCalled();
      expect(toastStore.get()).toBeFalsy();
    });

    it("onClose closes the camera without scanning", async () => {
      const { result } = await mount(kind);
      await act(() => result.current.cap.openCamera());
      act(() => result.current.cap.camera.onClose());
      expect(cfg.open(result.current)).toBe(false);
      expect(onPhoto).not.toHaveBeenCalled();
    });
  });

  describe("pickFromGallery", () => {
    it("hands the chosen photo over", async () => {
      pickImageFromLibrary.mockResolvedValue({ status: "picked", uri: "file://g.jpg" });
      const { result } = await mount(kind);
      await act(() => result.current.cap.pickFromGallery());
      expect(onPhoto).toHaveBeenCalledWith("file://g.jpg", "gallery");
    });

    it("says so when the photo library permission is refused", async () => {
      pickImageFromLibrary.mockResolvedValue({ status: "denied" });
      const { result } = await mount(kind);
      await act(() => result.current.cap.pickFromGallery());
      expect(onPhoto).not.toHaveBeenCalled();
      expect(toastStore.get()).toMatchObject({ type: "error" });
    });

    it("quietly does nothing when the picker is cancelled", async () => {
      pickImageFromLibrary.mockResolvedValue({ status: "canceled" });
      const { result } = await mount(kind);
      await act(() => result.current.cap.pickFromGallery());
      expect(onPhoto).not.toHaveBeenCalled();
      expect(toastStore.get()).toBeFalsy();
    });

    it("reports a picker that throws", async () => {
      pickImageFromLibrary.mockRejectedValue(new Error("native"));
      const { result } = await mount(kind);
      await act(() => result.current.cap.pickFromGallery());
      expect(toastStore.get()).toMatchObject({ type: "error" });
    });

    it("shows the paywall instead of opening the picker when the free limit is used", async () => {
      const { result } = await mount(kind);
      act(() => cfg.exhaust(result.current));
      await act(() => result.current.cap.pickFromGallery());
      expect(pickImageFromLibrary).not.toHaveBeenCalled();
      expect(result.current.modal.proReason).toBe(cfg.reason);
      expect(result.current.modal.proModalOpen).toBe(true);
    });
  });
});
