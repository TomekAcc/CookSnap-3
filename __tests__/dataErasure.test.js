import AsyncStorage from "@react-native-async-storage/async-storage";
import * as storage from "../src/storage/storage";

jest.mock("../src/utils/photoStorage", () => ({ deleteAllPhotos: jest.fn(() => 3), pruneUnusedPhotos: jest.fn(() => 0) }));
const { deleteAllPhotos } = require("../src/utils/photoStorage");
const { eraseAllLocalData } = require("../src/services/dataErasure");

beforeEach(async () => {
  await AsyncStorage.clear();
  storage.resetErasedFlag();
  jest.clearAllMocks();
});

describe("Delete all my data", () => {
  it("removes every cooksnap key, leaves other apps' keys alone, and deletes the photos", async () => {
    await AsyncStorage.multiSet([
      ["cooksnap:savedRecipes:v1", "[1]"],
      ["cooksnap:deviceId:v1", "abc"],
      ["cooksnap:feedbackOutbox:v1", "[{}]"],
      ["other:thing", "keep"],
    ]);
    const result = await eraseAllLocalData();
    expect(result).toEqual({ ok: true, keys: 3 });
    expect(await AsyncStorage.getItem("cooksnap:savedRecipes:v1")).toBeNull();
    expect(await AsyncStorage.getItem("cooksnap:feedbackOutbox:v1")).toBeNull();
    expect(await AsyncStorage.getItem("other:thing")).toBe("keep");
    expect(deleteAllPhotos).toHaveBeenCalledTimes(1);
  });

  it("blocks writes afterwards, so screens still on the old state cannot bring the data back", async () => {
    await AsyncStorage.setItem("cooksnap:pantry:v1", "[1]");
    await eraseAllLocalData();
    await storage.setItem("cooksnap:pantry:v1", "[1]");
    expect(await AsyncStorage.getItem("cooksnap:pantry:v1")).toBeNull();
  });

  it("reports failure instead of throwing when storage cannot be cleared", async () => {
    const spy = jest.spyOn(AsyncStorage, "getAllKeys").mockRejectedValueOnce(new Error("disk"));
    const result = await eraseAllLocalData();
    expect(result.ok).toBe(false);
    spy.mockRestore();
  });
});
