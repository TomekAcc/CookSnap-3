import * as ImagePicker from "expo-image-picker";

const OPTIONS = {
  mediaTypes: ["images"],
  quality: 0.9,
  exif: false,
};

function toResult(result) {
  const uri = result?.canceled ? null : result?.assets?.[0]?.uri;
  return uri ? { status: "picked", uri } : { status: "canceled" };
}

/**
 * Opens the system photo picker and reports what happened:
 *   { status: "denied" }              the phone refused access even to the picker
 *   { status: "canceled" }            the user closed the picker (or it returned no image)
 *   { status: "picked", uri }         one image
 * Anything else the native side throws is left to the caller's try/catch.
 *
 * No library permission is requested up front. The system pickers (iOS PHPicker, Android Photo Picker) hand over only
 * the photo the person chooses and need no access to the rest of the library, which is the privacy-friendly model
 * both stores steer apps toward. Asking for full-library access first also failed outright on Android 13+ builds that
 * do not declare the media permission. If a phone does insist on a permission, it is requested then, once.
 *
 * The same options everywhere: a photo scan is analysed at ~1280px anyway, so a high-quality original and its EXIF
 * metadata (location!) are never needed.
 */
export async function pickImageFromLibrary() {
  try {
    return toResult(await ImagePicker.launchImageLibraryAsync(OPTIONS));
  } catch (err) {
    if (!/permission/i.test(String(err?.message || err))) throw err;
  }
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };
  return toResult(await ImagePicker.launchImageLibraryAsync(OPTIONS));
}
