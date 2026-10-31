import * as ImagePicker from "expo-image-picker";

/**
 * Asks for photo-library permission, opens the picker, and reports what happened:
 *   { status: "denied" }              permission refused
 *   { status: "canceled" }            the user closed the picker (or it returned no image)
 *   { status: "picked", uri }         one image
 * Anything the native side throws is left to the caller's try/catch.
 *
 * The same options everywhere: a photo scan is analysed at ~1280px anyway, so
 * a high-quality original and its EXIF metadata (location!) are never needed.
 */
export async function pickImageFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    exif: false,
  });
  const uri = result.canceled ? null : result.assets?.[0]?.uri;
  return uri ? { status: "picked", uri } : { status: "canceled" };
}
