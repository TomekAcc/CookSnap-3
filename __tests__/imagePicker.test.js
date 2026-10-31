import * as ImagePicker from "expo-image-picker";
import { pickImageFromLibrary } from "../src/utils/imagePicker";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe("pickImageFromLibrary", () => {
  it("reports a refused permission without opening the picker", async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "denied" });
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("returns the chosen image's uri", async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://a.jpg" }] });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "picked", uri: "file://a.jpg" });
  });

  it("asks only for one image, without EXIF, at reduced quality", async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
    await pickImageFromLibrary();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 0.9, exif: false });
  });

  it("treats a cancelled picker, or a result with no image, as cancelled", async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "canceled" });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [] });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "canceled" });
  });

  it("lets native failures reach the caller", async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockRejectedValue(new Error("native"));
    await expect(pickImageFromLibrary()).rejects.toThrow("native");
  });
});
