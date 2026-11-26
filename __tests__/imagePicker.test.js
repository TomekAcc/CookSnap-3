import * as ImagePicker from "expo-image-picker";
import { pickImageFromLibrary } from "../src/utils/imagePicker";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

beforeEach(() => jest.resetAllMocks());

describe("pickImageFromLibrary", () => {
  it("opens the system picker without asking for library access first", async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://a.jpg" }] });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "picked", uri: "file://a.jpg" });
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it("asks only for one image, without EXIF, at reduced quality", async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
    await pickImageFromLibrary();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 0.9, exif: false });
  });

  it("treats a cancelled picker, or a result with no image, as cancelled", async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "canceled" });
    ImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [] });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "canceled" });
  });

  it("requests the permission once, only when the phone refuses to open the picker without it", async () => {
    ImagePicker.launchImageLibraryAsync
      .mockRejectedValueOnce(new Error("Missing permission to read media"))
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file://b.jpg" }] });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "picked", uri: "file://b.jpg" });
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("reports a refused permission without opening the picker again", async () => {
    ImagePicker.launchImageLibraryAsync.mockRejectedValueOnce(new Error("permission denied"));
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    await expect(pickImageFromLibrary()).resolves.toEqual({ status: "denied" });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  });

  it("lets other native failures reach the caller", async () => {
    ImagePicker.launchImageLibraryAsync.mockRejectedValue(new Error("native"));
    await expect(pickImageFromLibrary()).rejects.toThrow("native");
  });
});
