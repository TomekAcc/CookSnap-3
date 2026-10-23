import { useRef } from "react";
import { useCameraPermissions } from "expo-camera";
import { useEntitlements } from "../../context/EntitlementsContext";
import { useLanguage } from "../../context/LanguageContext";
import { useModalState } from "../../context/ModalContext";
import { useScan } from "../../context/ScanContext";
import { log } from "../../utils/log";
import { pickImageFromLibrary } from "../../utils/imagePicker";
import { showToast } from "../../utils/toast";

/**
 * Everything the fridge and pantry scanners share for getting a photo: the camera
 * permission and open/close state, the shutter, and the gallery picker.
 *
 * `onPhoto(uri, source)` receives the photo ("camera" | "gallery") and starts the scan.
 *
 * Opening the camera or gallery first checks the free daily cap and shows the paywall
 * straight away, so a capped-out user isn't walked through a permission prompt for
 * nothing. It never consumes an allowance itself (that happens inside the scan), so
 * denying a permission or backing out of the camera never burns a scan.
 */
export function useScanCapture(kind, onPhoto) {
  const isPantry = kind === "pantry";
  const { t } = useLanguage();
  const scan = useScan();
  const { canScanFridge, canScanPantry } = useEntitlements();
  const { setProModalOpen, setProReason } = useModalState();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const cameraOpen = isPantry ? scan.pantryCameraOpen : scan.cameraOpen;
  const setCameraOpen = isPantry ? scan.setPantryCameraOpen : scan.setCameraOpen;
  const canScan = isPantry ? canScanPantry : canScanFridge;
  const paywallReason = isPantry ? "pantryScan" : "scan";
  const cameraPermissionError = isPantry ? "errors.pantryCameraPermission" : "errors.cameraPermission";

  const showPaywall = () => {
    setProReason?.(paywallReason);
    setProModalOpen?.(true);
  };

  const openCamera = async () => {
    if (!canScan) {
      showPaywall();
      return;
    }
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          showToast?.(t(cameraPermissionError), "error");
          return;
        }
      }
      setCameraOpen(true);
    } catch (err) {
      log.warn("[Cook AI] Failed to open camera:", err?.message);
      showToast?.(t("errors.openCameraFailed"), "error");
    }
  };

  const closeCamera = () => setCameraOpen(false);

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, imageType: "jpg" });
      setCameraOpen(false);
      await onPhoto(photo.uri, "camera");
    } catch (err) {
      log.warn("[Cook AI] Failed to capture photo:", err?.message);
      setCameraOpen(false);
      showToast?.(t("errors.capturePhotoFailed"), "error");
    }
  };

  const pickFromGallery = async () => {
    if (!canScan) {
      showPaywall();
      return;
    }
    try {
      const picked = await pickImageFromLibrary();
      if (picked.status === "denied") {
        showToast?.(t("errors.galleryPermission"), "error");
      } else if (picked.status === "picked") {
        await onPhoto(picked.uri, "gallery");
      }
    } catch (err) {
      log.warn("[Cook AI] Failed to pick photo from gallery:", err?.message);
      showToast?.(t("errors.loadPhotoFailed"), "error");
    }
  };

  return {
    camera: { open: cameraOpen, cameraRef, onClose: closeCamera, onCapture: capture },
    openCamera,
    pickFromGallery,
  };
}
