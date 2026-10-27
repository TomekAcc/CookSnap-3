import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ModalProvider } from "../src/context/ModalContext";
import { ThemeProvider } from "../src/context/ThemeContext";
import { AppProviders } from "../src/context/AppProviders";
import { useScan } from "../src/context/ScanContext";
import { useInventory } from "../src/context/InventoryContext";
import FridgeScannerHero from "../src/components/FridgeScannerHero";
import PantryScannerHero from "../src/components/PantryScannerHero";

// Renders the real scanner components through each stage. This is what catches a bad
// import or a missing prop in one of the extracted cards (a Jest stub of the icon set
// alone can't), the way the on-device app would crash on it.

jest.mock("../src/services/geminiVision", () => ({
  ...jest.requireActual("../src/services/geminiVision"),
  analyzeFridgeImage: jest.fn(),
  analyzePantryImage: jest.fn(),
}));
jest.mock("../src/utils/photoStorage", () => ({ persistPhotoToDevice: (uri) => `kept:${uri}` }));
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  CameraView: () => null,
}));
// Reanimated needs its native worklets runtime; the laser overlay is purely visual (covered by the golden-frame harness).
jest.mock("../src/components/ScanLaserOverlay", () => () => null);
jest.setTimeout(30000);
const vision = require("../src/services/geminiVision");

let ctx;
function Probe() {
  ctx = { scan: useScan(), inv: useInventory() };
  return null;
}

const mount = async (ui) => {
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
      <ThemeProvider>
        <ModalProvider>
          <AppProviders>
            <Probe />
            {ui}
          </AppProviders>
        </ModalProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(ctx.scan).toBeTruthy());
  await act(async () => {});
};

// Run the scan choreography (laser/progress -> hold -> reveal) to its end.
const finishScan = async () => {
  for (let i = 0; i < 40; i++) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  // jest-expo's native ImageLoader stub doesn't match RN's getSize signature.
  jest.spyOn(Image, "getSize").mockImplementation((uri, ok) => ok(390, 520));
  jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
});
afterEach(() => {
  jest.useRealTimers();
  console.warn.mockRestore();
  Image.getSize.mockRestore();
});

describe("FridgeScannerHero", () => {
  it("idle: offers camera and gallery", async () => {
    await mount(<FridgeScannerHero />);
    expect(screen.getByText("Take Photo")).toBeTruthy();
    expect(screen.getByText("From Gallery")).toBeTruthy();
  });

  it("scanning shows the progress panel, and a finished scan lists the detected items", async () => {
    let resolveScan;
    vision.analyzeFridgeImage.mockReturnValue(new Promise((r) => (resolveScan = r)));
    await mount(<FridgeScannerHero />);
    act(() => {
      ctx.scan.completeScan("file://fridge.jpg", "gallery");
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Looking at your photo")).toBeTruthy();

    resolveScan([{ name: "Milk" }, { name: "Eggs" }]);
    await finishScan();
    await waitFor(() => expect(screen.getByText("Milk")).toBeTruthy());
    expect(screen.getByText("Eggs")).toBeTruthy();
  });

  it("a scan that finds nothing shows the empty state and lets the user add items by hand", async () => {
    vision.analyzeFridgeImage.mockResolvedValue([]);
    await mount(<FridgeScannerHero />);
    act(() => {
      ctx.scan.completeScan("file://empty.jpg", "gallery");
    });
    await finishScan();
    await waitFor(() => expect(screen.getByText("Nothing detected")).toBeTruthy());
  });

  it("the add-an-item input adds to the fridge", async () => {
    vision.analyzeFridgeImage.mockResolvedValue([{ name: "Milk" }]);
    await mount(<FridgeScannerHero />);
    act(() => {
      ctx.scan.completeScan("file://f.jpg", "gallery");
    });
    await finishScan();
    await waitFor(() => expect(screen.getByText("Milk")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Mozzarella, Garlic..."), "Garlic");
    fireEvent(screen.getByPlaceholderText("e.g. Mozzarella, Garlic..."), "submitEditing");
    await waitFor(() => expect(ctx.inv.ingredients.map((i) => i.name)).toContain("Garlic"));
  });
});

describe("PantryScannerHero", () => {
  it("idle: offers camera and gallery", async () => {
    await mount(<PantryScannerHero />);
    expect(screen.getByText("Scan Pantry")).toBeTruthy();
    expect(screen.getByText("From Gallery")).toBeTruthy();
  });
});

describe("SamplePantryCard", () => {
  const SamplePantryCard = require("../src/components/SamplePantryCard").default;

  it("lists the sample staples only while the sample fridge shows and nothing is stocked", async () => {
    await mount(<SamplePantryCard />);
    expect(screen.queryByText("Sample pantry")).toBeNull();

    act(() => ctx.inv.markScanDemo(true));
    expect(await screen.findByText("Sample pantry")).toBeTruthy();
    expect(screen.getByText("Rice")).toBeTruthy();
    expect(screen.getByText("Black pepper")).toBeTruthy();

    // The person stocks their own pantry: the sample steps aside (the generator ignores it too).
    act(() => ctx.inv.addPantryItem({ id: "p", name: "Salt", category: "Spices & Herbs" }));
    await waitFor(() => expect(screen.queryByText("Sample pantry")).toBeNull());

    // And a real scan ends the sample altogether.
    act(() => ctx.inv.markScanDemo(false));
    expect(screen.queryByText("Sample pantry")).toBeNull();
  });
});
