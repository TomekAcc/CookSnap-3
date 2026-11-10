// The live checks pass raw base64 images, which never reach the native module.
module.exports = {
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: async () => {
    throw new Error("expo-image-manipulator is not available in live checks — pass base64 input");
  },
};
