import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

const MAX_DIMENSION = 1280;
const JPEG_COMPRESSION = 0.8;

/**
 * Downscales and compresses a captured/picked photo before it's sent to a
 * vision API. Full-resolution camera photos can be several MB — uploading
 * them raw over a mobile connection risks request timeouts and oversized
 * payload errors. 1280px @ 0.8 quality is the sweet spot for Gemini to still
 * read small text on jar/condiment labels while keeping the payload small.
 */
export async function prepareImageForVision(uri: string): Promise<{ uri: string; base64: string }> {
  const result = await manipulateAsync(uri, [{ resize: { width: MAX_DIMENSION } }], {
    compress: JPEG_COMPRESSION,
    format: SaveFormat.JPEG,
    base64: true,
  });

  return { uri: result.uri, base64: result.base64 ?? "" };
}
