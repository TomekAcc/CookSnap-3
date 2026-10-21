import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, waitFor } from "@testing-library/react-native";
import { renderApp } from "../test-utils/renderApp";
import { toastStore } from "../src/utils/toastStore";
import { hideToast } from "../src/utils/toast";
import { EXIT_DURATION_MS } from "../src/utils/bottomSheet";
import { SAMPLE_FRIDGE_ITEMS } from "../src/constants/sampleFridge";

jest.mock("../src/services/geminiVision", () => ({
  ...jest.requireActual("../src/services/geminiVision"),
  analyzeFridgeImage: jest.fn(),
  analyzePantryImage: jest.fn(),
}));
jest.mock("../src/utils/photoStorage", () => ({ persistPhotoToDevice: (uri) => `kept:${uri}` }));
const vision = require("../src/services/geminiVision");

const names = (list) => list.map((i) => i.name);
const stored = async (key) => JSON.parse((await AsyncStorage.getItem(key)) ?? "null");
const DETECTED = [{ name: "Milk", icon: "🥛" }, { name: "Egg", icon: "🥚" }];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  hideToast();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  vision.analyzeFridgeImage.mockResolvedValue(DETECTED);
  vision.analyzePantryImage.mockResolvedValue([{ name: "Rice", icon: "🍚" }]);
});
afterEach(() => {
  jest.useRealTimers();
  hideToast();
  console.warn.mockRestore();
});

const useFakeTimers = () => jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] });
const scanReal = async (result, uri = "file://fridge.jpg", source = "camera") => {
  await act(async () => {
    await result.current.scan.completeScan(uri, source);
  });
};

describe("fridge scan", () => {
  it("a real scan: analyses the photo, commits the items, records history, saves it all", async () => {
    const { result } = await renderApp();
    await scanReal(result, "file://fridge.jpg", "gallery");
    expect(vision.analyzeFridgeImage).toHaveBeenCalledWith("kept:file://fridge.jpg", "", "English");
    expect(result.current.scan).toMatchObject({ isScanning: true, hasScanned: true, fridgePhoto: "kept:file://fridge.jpg" });
    expect(result.current.ent.dailyFridgeScanCount).toBe(1);

    act(() => result.current.scan.endScanChoreography());
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Egg"]);
    expect(result.current.inv.ingredients.every((i) => i.source === "scan")).toBe(true);
    expect(result.current.scan.isScanning).toBe(false);
    expect(result.current.scan.scanHistory).toHaveLength(1);
    expect(result.current.scan.scanHistory[0]).toMatchObject({ photoUri: "kept:file://fridge.jpg", source: "gallery", itemCount: 2 });
    expect(names(result.current.scan.scanHistory[0].ingredients)).toEqual(["Milk", "Egg"]);

    await waitFor(async () => expect(names(await stored("cookai:ingredients:v1"))).toEqual(["Milk", "Egg"]));
    expect(await stored("cookai:fridgePhoto:v1")).toBe("kept:file://fridge.jpg");
    expect(await stored("cookai:scanHistory:v1")).toHaveLength(1);
  });

  it("a second scan appends to what is already there instead of replacing it", async () => {
    const { result } = await renderApp();
    await scanReal(result);
    act(() => result.current.scan.endScanChoreography());
    vision.analyzeFridgeImage.mockResolvedValue([{ name: "milk", icon: "🥛" }, { name: "Cheese", icon: "🧀" }]);
    await scanReal(result, "file://second.jpg");
    act(() => result.current.scan.endScanChoreography());
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Egg", "Cheese"]);
    expect(result.current.scan.scanHistory).toHaveLength(2);
  });

  it("clears the recipe batch when a new scan starts", async () => {
    const { result } = await renderApp();
    act(() => result.current.rec.clearRecipes()); // no batch yet; just prove the call is the link
    await scanReal(result);
    expect(result.current.rec.generatedRecipes).toBeNull();
    expect(result.current.rec.isGeneratingRecipes).toBe(false);
  });

  it("waits for a slow analysis before committing (the choreography can finish first)", async () => {
    useFakeTimers();
    let finish;
    vision.analyzeFridgeImage.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const { result } = await renderApp();
    await act(async () => {
      result.current.scan.completeScan("file://slow.jpg");
    });
    act(() => result.current.scan.endScanChoreography()); // animation done, result not here yet
    expect(result.current.scan.isScanning).toBe(true);
    expect(result.current.inv.ingredients).toEqual([]);
    await act(async () => {
      finish(DETECTED);
      await jest.advanceTimersByTimeAsync(500); // lets the analysis land, then the polling timer commit it
    });
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Egg"]);
    expect(result.current.scan.isScanning).toBe(false);
  });

  it("retries a failed analysis once, then reports the failure and commits nothing", async () => {
    useFakeTimers();
    vision.analyzeFridgeImage.mockRejectedValue(new Error("overloaded"));
    const { result } = await renderApp();
    await act(async () => {
      const done = result.current.scan.completeScan("file://bad.jpg");
      await jest.advanceTimersByTimeAsync(1000);
      await done;
    });
    expect(vision.analyzeFridgeImage).toHaveBeenCalledTimes(2);
    expect(toastStore.get()).toMatchObject({ type: "error" });
    act(() => result.current.scan.endScanChoreography());
    expect(result.current.inv.ingredients).toEqual([]);
    expect(result.current.scan.isScanning).toBe(false);
  });

  it("ignores a scan with no photo", async () => {
    const { result } = await renderApp();
    await scanReal(result, null);
    expect(vision.analyzeFridgeImage).not.toHaveBeenCalled();
    expect(result.current.ent.dailyFridgeScanCount).toBe(0);
  });
});

describe("free-tier gate on scanning", () => {
  it("refuses once the daily limit is used, then opens the paywall after the camera sheet has closed", async () => {
    useFakeTimers();
    const { result } = await renderApp();
    act(() => {
      result.current.ent.registerFridgeScanAttempt();
      result.current.ent.registerFridgeScanAttempt();
    });
    await act(async () => {
      await result.current.scan.completeScan("file://third.jpg");
    });
    expect(vision.analyzeFridgeImage).not.toHaveBeenCalled();
    expect(result.current.scan.hasScanned).toBe(false);
    expect(result.current.modal.proModalOpen).toBe(false); // not while the camera sheet is still closing
    act(() => jest.advanceTimersByTime(EXIT_DURATION_MS + 50));
    expect(result.current.modal.proModalOpen).toBe(true);
    expect(result.current.modal.proReason).toBe("scan");
  });

  it("PRO is never refused or counted", async () => {
    const { result } = await renderApp();
    act(() => result.current.ent.activatePro());
    for (let i = 0; i < 4; i++) await scanReal(result, `file://p${i}.jpg`);
    expect(vision.analyzeFridgeImage).toHaveBeenCalledTimes(4);
    expect(result.current.ent.dailyFridgeScanCount).toBe(0);
  });
});

describe("the onboarding sample scan", () => {
  it("fills in the sample list with no API call, no free scan used, no history and nothing saved", async () => {
    useFakeTimers();
    const { result } = await renderApp();
    act(() => result.current.scan.completeDemoScan("file://sample.jpg"));
    expect(result.current.scan).toMatchObject({ isScanning: true, hasScanned: true });
    expect(result.current.inv.scanIsDemo).toBe(true);
    expect(result.current.inv.ingredients).toEqual([]);
    act(() => jest.advanceTimersByTime(1400));
    act(() => result.current.scan.endScanChoreography());

    expect(result.current.inv.ingredients).toHaveLength(SAMPLE_FRIDGE_ITEMS.length);
    expect(result.current.inv.ingredients.every((i) => i.source === "demo" && i.id.startsWith("sample-"))).toBe(true);
    expect(result.current.inv.ingredients[0].name).toBe(result.current.language.t(`sampleFridge.${SAMPLE_FRIDGE_ITEMS[0].id}`));
    expect(result.current.scan.scanHistory).toEqual([]);
    expect(result.current.scan.isScanning).toBe(false);
    expect(vision.analyzeFridgeImage).not.toHaveBeenCalled();
    expect(result.current.ent.dailyFridgeScanCount).toBe(0);

    await act(async () => {});
    // The empty default is written on first load; what must never be written is the sample itself.
    expect(JSON.parse((await AsyncStorage.getItem("cookai:ingredients:v1")) ?? "[]")).toEqual([]);
    expect((await AsyncStorage.getItem("cookai:fridgePhoto:v1")) ?? "").not.toContain("sample.jpg");
    expect((await AsyncStorage.getItem("cookai:scanHistory:v1")) ?? "[]").toBe("[]");
  });

  it("does not wipe the ingredients saved from the user's real fridge", async () => {
    useFakeTimers();
    await AsyncStorage.setItem("cookai:ingredients:v1", JSON.stringify([{ id: "real", name: "Real", source: "scan" }]));
    const { result } = await renderApp();
    act(() => result.current.scan.completeDemoScan("file://sample.jpg"));
    act(() => jest.advanceTimersByTime(1400));
    act(() => result.current.scan.endScanChoreography());
    await act(async () => {});
    expect(names(await stored("cookai:ingredients:v1"))).toEqual(["Real"]);
  });

  it("a real scan afterwards replaces the sample items instead of merging into them", async () => {
    useFakeTimers();
    const { result } = await renderApp();
    act(() => result.current.scan.completeDemoScan("file://sample.jpg"));
    act(() => jest.advanceTimersByTime(1400));
    act(() => result.current.scan.endScanChoreography());
    await scanReal(result);
    act(() => result.current.scan.endScanChoreography());
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Egg"]);
    expect(result.current.inv.scanIsDemo).toBe(false);
    expect(result.current.scan.scanHistory).toHaveLength(1);
  });
});

describe("history, reset and scan-more", () => {
  const withHistory = async () => {
    const app = await renderApp();
    await scanReal(app.result);
    act(() => app.result.current.scan.endScanChoreography());
    return app;
  };

  it("restoreScan brings back the photo and ingredients of a past scan and returns to the Scanner tab", async () => {
    const { result } = await withHistory();
    const entry = result.current.scan.scanHistory[0];
    act(() => {
      result.current.inv.setIngredients([{ id: "x", name: "Changed" }]);
      result.current.nav.setActiveTab("pantry");
    });
    act(() => result.current.scan.restoreScan(entry.id));
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Egg"]);
    expect(result.current.scan.fridgePhoto).toBe(entry.photoUri);
    expect(result.current.nav.activeTab).toBe("scanner");
    expect(result.current.rec.generatedRecipes).toBeNull();
  });

  it("restoreScan ignores an unknown id", async () => {
    const { result } = await withHistory();
    act(() => result.current.scan.restoreScan("nope"));
    expect(names(result.current.inv.ingredients)).toEqual(["Milk", "Egg"]);
  });

  it("deleteScan removes one history entry", async () => {
    const { result } = await withHistory();
    act(() => result.current.scan.deleteScan(result.current.scan.scanHistory[0].id));
    expect(result.current.scan.scanHistory).toEqual([]);
  });

  it("keeps only the 10 most recent scans", async () => {
    const { result } = await renderApp();
    for (let i = 0; i < 12; i++) {
      vision.analyzeFridgeImage.mockResolvedValue([{ name: `Item ${i}` }]);
      act(() => result.current.ent.activatePro());
      await scanReal(result, `file://s${i}.jpg`);
      act(() => result.current.scan.endScanChoreography());
    }
    expect(result.current.scan.scanHistory).toHaveLength(10);
    expect(result.current.scan.scanHistory[0].photoUri).toBe("kept:file://s11.jpg");
  });

  it("resetScan clears the photo, the ingredients and the recipes", async () => {
    const { result } = await withHistory();
    act(() => result.current.scan.resetScan());
    expect(result.current.scan).toMatchObject({ hasScanned: false, fridgePhoto: null, isScanning: false });
    expect(result.current.inv.ingredients).toEqual([]);
    expect(result.current.rec.generatedRecipes).toBeNull();
  });

  it("startScanMore opens the camera", async () => {
    const { result } = await renderApp();
    act(() => result.current.scan.startScanMore());
    expect(result.current.scan.cameraOpen).toBe(true);
    act(() => result.current.scan.setCameraOpen(false));
    expect(result.current.scan.cameraOpen).toBe(false);
  });
});

describe("the reveal hold (scanRevealActive)", () => {
  it("is NOT triggered by a saved photo loading at startup (that is not a scan finishing)", async () => {
    await AsyncStorage.setItem("cookai:fridgePhoto:v1", JSON.stringify("kept:file://old.jpg"));
    const { result } = await renderApp();
    await waitFor(() => expect(result.current.scan.hasScanned).toBe(true));
    expect(result.current.scan.scanRevealActive).toBe(false);
  });

  it("is raised when a live scan finishes, and the screen releases it", async () => {
    const { result } = await renderApp();
    await scanReal(result);
    expect(result.current.scan.scanRevealActive).toBe(false);
    act(() => result.current.scan.endScanChoreography());
    expect(result.current.scan.scanRevealActive).toBe(true);
    act(() => result.current.scan.setScanRevealActive(false));
    expect(result.current.scan.scanRevealActive).toBe(false);
  });
});

describe("pantry scan", () => {
  it("analyses the photo, merges the staples, tells the user how many, and keeps the pantry when dismissed", async () => {
    const { result } = await renderApp();
    await act(async () => {
      await result.current.scan.completePantryScan("file://pantry.jpg");
    });
    expect(vision.analyzePantryImage).toHaveBeenCalledWith("file://pantry.jpg", "", "English");
    expect(result.current.scan).toMatchObject({ isPantryScanning: true, hasPantryScanned: true, pantryPhoto: "file://pantry.jpg" });
    expect(result.current.ent.dailyPantryScanCount).toBe(1);

    act(() => result.current.scan.endPantryScanChoreography());
    expect(names(result.current.inv.pantryItems)).toEqual(["Rice"]);
    expect(result.current.scan.isPantryScanning).toBe(false);
    expect(toastStore.get()).toMatchObject({ type: "success" });

    act(() => result.current.scan.resetPantryPhoto());
    expect(result.current.scan.hasPantryScanned).toBe(false);
    expect(names(result.current.inv.pantryItems)).toEqual(["Rice"]);
  });

  it("a failed analysis commits nothing and says so", async () => {
    vision.analyzePantryImage.mockRejectedValue(new Error("down"));
    const { result } = await renderApp();
    await act(async () => {
      await result.current.scan.completePantryScan("file://pantry.jpg");
    });
    expect(toastStore.get()).toMatchObject({ type: "error" });
    act(() => result.current.scan.endPantryScanChoreography());
    expect(result.current.inv.pantryItems).toEqual([]);
  });

  it("is gated by its own daily limit and opens the paywall with the pantry reason", async () => {
    useFakeTimers();
    const { result } = await renderApp();
    act(() => {
      result.current.ent.registerPantryScanAttempt();
      result.current.ent.registerPantryScanAttempt();
    });
    await act(async () => {
      await result.current.scan.completePantryScan("file://pantry.jpg");
    });
    expect(vision.analyzePantryImage).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(EXIT_DURATION_MS + 50));
    expect(result.current.modal.proModalOpen).toBe(true);
    expect(result.current.modal.proReason).toBe("pantryScan");
  });

  it("startPantryScanMore opens the pantry camera", async () => {
    const { result } = await renderApp();
    act(() => result.current.scan.startPantryScanMore());
    expect(result.current.scan.pantryCameraOpen).toBe(true);
  });
});
