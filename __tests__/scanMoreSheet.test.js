import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ModalProvider, useModalState } from "../src/context/ModalContext";
import { ThemeProvider } from "../src/context/ThemeContext";
import { AppProviders } from "../src/context/AppProviders";
import { useScan } from "../src/context/ScanContext";
import { useEntitlements } from "../src/context/EntitlementsContext";
import { useInventory } from "../src/context/InventoryContext";
import ScanMoreSheet from "../src/components/scanner/ScanMoreSheet";
import { EXIT_DURATION_MS } from "../src/utils/bottomSheet";
import { toastStore } from "../src/utils/toastStore";
import { hideToast } from "../src/utils/toast";

jest.mock("../src/services/geminiVision", () => ({
  ...jest.requireActual("../src/services/geminiVision"),
  analyzeFridgeImage: jest.fn(),
  analyzePantryImage: jest.fn(),
}));
jest.mock("../src/utils/photoStorage", () => ({ persistPhotoToDevice: (uri) => `kept:${uri}` }));
jest.mock("../src/utils/imagePicker", () => ({ pickImageFromLibrary: jest.fn() }));
jest.setTimeout(30000); // the first mount in a cold worker is slow
const vision = require("../src/services/geminiVision");
const { pickImageFromLibrary } = require("../src/utils/imagePicker");

const ANCHOR = { x: 250, y: 100, width: 100, height: 30 };
let ctx;
function Probe() {
  ctx = { modal: useModalState(), scan: useScan(), ent: useEntitlements(), inv: useInventory() };
  return null;
}

const mount = async (kind) => {
  render(
    <ThemeProvider>
      <ModalProvider>
        <AppProviders>
          <Probe />
          <ScanMoreSheet kind={kind} anchor={ANCHOR} />
        </AppProviders>
      </ModalProvider>
    </ThemeProvider>
  );
  await waitFor(() => expect(ctx.scan).toBeTruthy());
  await act(async () => {});
};
const openSheet = (kind) => act(() => (kind === "pantry" ? ctx.modal.setPantryScanOpen(true) : ctx.modal.setScanMoreOpen(true)));
const isOpen = (kind) => (kind === "pantry" ? ctx.modal.pantryScanOpen : ctx.modal.scanMoreOpen);
const handoff = () => act(() => jest.advanceTimersByTime(EXIT_DURATION_MS + 60));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  hideToast();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
  vision.analyzeFridgeImage.mockResolvedValue([{ name: "Milk" }]);
  vision.analyzePantryImage.mockResolvedValue([{ name: "Rice" }]);
});
afterEach(() => {
  jest.useRealTimers();
  hideToast();
  console.warn.mockRestore();
});

describe.each([
  ["fridge", { camera: (c) => c.scan.cameraOpen, analyse: () => vision.analyzeFridgeImage, reason: "scan", exhaust: (c) => { c.ent.registerFridgeScanAttempt(); c.ent.registerFridgeScanAttempt(); } }],
  ["pantry", { camera: (c) => c.scan.pantryCameraOpen, analyse: () => vision.analyzePantryImage, reason: "pantryScan", exhaust: (c) => { c.ent.registerPantryScanAttempt(); c.ent.registerPantryScanAttempt(); } }],
])("ScanMoreSheet (%s)", (kind, cfg) => {
  it("renders nothing until its own flag is opened", async () => {
    await mount(kind);
    expect(screen.queryByLabelText("Take Photo")).toBeNull();
    await openSheet(kind);
    expect(screen.getByLabelText("Take Photo")).toBeTruthy();
    expect(screen.getByLabelText("From Gallery")).toBeTruthy();
  });

  it("only opens for its own kind (the other kind's flag does nothing here)", async () => {
    await mount(kind);
    await act(() => (kind === "pantry" ? ctx.modal.setScanMoreOpen(true) : ctx.modal.setPantryScanOpen(true)));
    expect(screen.queryByLabelText("Take Photo")).toBeNull();
  });

  it("Take Photo closes the popover, then opens the camera after the native-modal handoff", async () => {
    await mount(kind);
    await openSheet(kind);
    fireEvent.press(screen.getByLabelText("Take Photo"));
    expect(isOpen(kind)).toBe(false);
    expect(cfg.camera(ctx)).toBe(false); // not in the same tick as the popover closing
    handoff();
    expect(cfg.camera(ctx)).toBe(true);
  });

  it("when the free limit is used, Take Photo opens the paywall for the right reason instead", async () => {
    await mount(kind);
    act(() => cfg.exhaust(ctx));
    await openSheet(kind);
    fireEvent.press(screen.getByLabelText("Take Photo"));
    handoff();
    expect(cfg.camera(ctx)).toBe(false);
    expect(ctx.modal.proModalOpen).toBe(true);
    expect(ctx.modal.proReason).toBe(cfg.reason);
  });

  it("From Gallery scans the picked photo after the handoff", async () => {
    pickImageFromLibrary.mockResolvedValue({ status: "picked", uri: "file://p.jpg" });
    await mount(kind);
    await openSheet(kind);
    fireEvent.press(screen.getByLabelText("From Gallery"));
    expect(isOpen(kind)).toBe(false);
    expect(pickImageFromLibrary).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(EXIT_DURATION_MS + 60);
    });
    await waitFor(() => expect(cfg.analyse()).toHaveBeenCalledTimes(1));
    expect(cfg.analyse().mock.calls[0][0]).toContain("file://p.jpg");
  });

  it("a refused photo-library permission says so and scans nothing", async () => {
    pickImageFromLibrary.mockResolvedValue({ status: "denied" });
    await mount(kind);
    await openSheet(kind);
    fireEvent.press(screen.getByLabelText("From Gallery"));
    await act(async () => {
      jest.advanceTimersByTime(EXIT_DURATION_MS + 60);
    });
    await waitFor(() => expect(toastStore.get()).toMatchObject({ type: "error" }));
    expect(cfg.analyse()).not.toHaveBeenCalled();
  });

  it("closing the picker without choosing scans nothing and does not use a free scan", async () => {
    pickImageFromLibrary.mockResolvedValue({ status: "canceled" });
    await mount(kind);
    await openSheet(kind);
    fireEvent.press(screen.getByLabelText("From Gallery"));
    await act(async () => {
      jest.advanceTimersByTime(EXIT_DURATION_MS + 60);
    });
    await act(async () => {});
    expect(cfg.analyse()).not.toHaveBeenCalled();
    expect(ctx.ent.dailyFridgeScanCount + ctx.ent.dailyPantryScanCount).toBe(0);
  });

  it("when the free limit is used, From Gallery opens the paywall and never touches the picker", async () => {
    await mount(kind);
    act(() => cfg.exhaust(ctx));
    await openSheet(kind);
    fireEvent.press(screen.getByLabelText("From Gallery"));
    handoff();
    expect(pickImageFromLibrary).not.toHaveBeenCalled();
    expect(ctx.modal.proReason).toBe(cfg.reason);
  });

  it("tapping outside closes it", async () => {
    await mount(kind);
    await openSheet(kind);
    const backdrop = screen.UNSAFE_root.findAll((n) => typeof n.props.onPress === "function" && !n.props.accessibilityLabel)[0];
    act(() => backdrop.props.onPress());
    expect(isOpen(kind)).toBe(false);
  });

  it("the Android back button closes it", async () => {
    await mount(kind);
    await openSheet(kind);
    act(() => screen.UNSAFE_getByType(require("react-native").Modal).props.onRequestClose());
    expect(isOpen(kind)).toBe(false);
  });
});
