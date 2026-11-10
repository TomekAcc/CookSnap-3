import { generateContent } from "../src/services/geminiClient";
import { analyzeFridgeImage } from "../src/services/geminiVision";

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("../src/services/geminiClient", () => ({
  ...jest.requireActual("../src/services/geminiClient"),
  generateContent: jest.fn(),
}));

// Long enough that compressPhotoForVision treats it as ready-made base64 and skips the image manipulator.
const PHOTO = "A".repeat(600);
const ok = (text) => ({ ok: true, status: 200, text });
const items = JSON.stringify([{ name: "Milk", icon: "🥛" }, { name: "Eggs", icon: "🥚" }]);

describe("analyzeFridgeImage empty answers", () => {
  beforeEach(() => generateContent.mockReset());

  it("tries the next model when the first one answers with an empty list", async () => {
    generateContent.mockResolvedValueOnce(ok("[]")).mockResolvedValueOnce(ok(items));
    const found = await analyzeFridgeImage(PHOTO, "key");
    expect(found.map((i) => i.name)).toEqual(["Milk", "Eggs"]);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("reports an empty fridge only when every model said so", async () => {
    generateContent.mockResolvedValue(ok("[]"));
    expect(await analyzeFridgeImage(PHOTO, "key")).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("an empty answer still counts when the other model failed outright", async () => {
    generateContent
      .mockResolvedValueOnce({ ok: false, status: 503, errorText: "overloaded" })
      .mockResolvedValueOnce(ok("[]"));
    expect(await analyzeFridgeImage(PHOTO, "key")).toEqual([]);
  });

  it("still throws when every model failed, so the caller can retry and show the error", async () => {
    generateContent.mockResolvedValue({ ok: false, status: 503, errorText: "overloaded" });
    await expect(analyzeFridgeImage(PHOTO, "key")).rejects.toThrow(/503/);
  });

  it("returns items straight away when the first model finds them", async () => {
    generateContent.mockResolvedValueOnce(ok(items));
    expect((await analyzeFridgeImage(PHOTO, "key")).length).toBe(2);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
