import React, { useRef, useState } from "react";
import { Animated, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useModalState } from "../context/ModalContext";
import { useScan } from "../context/ScanContext";
import DetectedIngredientsCard from "./scanner/DetectedIngredientsCard";
import FridgeIdleCard from "./scanner/FridgeIdleCard";
import FridgePhotoCard from "./scanner/FridgePhotoCard";
import FridgeScanProgress from "./scanner/FridgeScanProgress";
import NoItemsFound from "./scanner/NoItemsFound";
import PhotoViewerModal from "./scanner/PhotoViewerModal";
import ScanCameraModal from "./scanner/ScanCameraModal";
import ScanMoreSheet from "./scanner/ScanMoreSheet";
import useFridgeScanChoreography from "./scanner/useFridgeScanChoreography";
import useManualAdd from "./scanner/useManualAdd";
import { useScanCapture } from "./scanner/useScanCapture";

/**
 * Instant Scan + Vision Radar screen.
 * Capture → laser/radar while AI runs → shrink → ingredients.
 * Scan More appends de-duped items.
 *
 * This is only the composition: the timeline lives in useFridgeScanChoreography, getting a
 * photo in useScanCapture, and each stage's card in components/scanner/.
 */
export default function FridgeScannerHero() {
  const { t } = useLanguage();
  const { isScanning, fridgePhoto, resetScan } = useScan();
  const { setScanMoreOpen } = useModalState();
  const choreo = useFridgeScanChoreography();
  const { scanStage, hasFood } = choreo;
  const manualAdd = useManualAdd();
  const { camera, openCamera, pickFromGallery } = useScanCapture("fridge", choreo.beginInstantScan);

  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const scanMoreButtonRef = useRef(null);
  const [scanMoreAnchor, setScanMoreAnchor] = useState(null);

  const startScanAgain = () => {
    manualAdd.reset();
    resetScan();
  };

  const handleScanMore = () => {
    if (isScanning) return;
    scanMoreButtonRef.current?.measureInWindow((x, y, width, height) => {
      setScanMoreAnchor({ x, y, width, height });
      setScanMoreOpen?.(true);
    });
  };

  return (
    <>
      <View style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
        {scanStage === "idle" && (
          <FridgeIdleCard
            firstScanHintPulse={choreo.firstScanHintPulse}
            handleOpenCamera={openCamera}
            handlePickFromGallery={pickFromGallery}
          />
        )}

        {scanStage !== "idle" && (
          <>
            <FridgePhotoCard
              completionFlash={choreo.completionFlash}
              foodCount={choreo.foodCount}
              handleScanMore={handleScanMore}
              hasFood={hasFood}
              ingredientsOpacity={choreo.ingredientsOpacity}
              ingredientsTranslate={choreo.ingredientsTranslate}
              photoHeightAnim={choreo.photoHeightAnim}
              scanDisplayHeight={choreo.scanDisplayHeight}
              scanMoreButtonRef={scanMoreButtonRef}
              scanStage={scanStage}
              setPhotoViewerOpen={setPhotoViewerOpen}
              startScanAgain={startScanAgain}
            />

            {/* CookSnap Vision Radar */}
            {scanStage === "scanning" && (
              <FridgeScanProgress
                currentStepIdx={choreo.currentStepIdx}
                hasFood={hasFood}
                iconPulse={choreo.iconPulse}
                progressBarAnim={choreo.progressBarAnim}
                radarOpacity={choreo.radarOpacity}
                radarTranslate={choreo.radarTranslate}
                stepOpacity={choreo.stepOpacity}
                stepTranslate={choreo.stepTranslate}
              />
            )}

            {/* Ingredients — only after scan fully completes */}
            {scanStage === "completed" && !isScanning && (
              <Animated.View
                style={{
                  opacity: choreo.ingredientsOpacity,
                  transform: [{ translateY: choreo.ingredientsTranslate }],
                  marginTop: 22,
                }}
              >
                {!hasFood ? (
                  <NoItemsFound
                    handleOpenCamera={openCamera}
                    handlePickFromGallery={pickFromGallery}
                    manualAdd={manualAdd}
                  />
                ) : (
                  <DetectedIngredientsCard chipReveal={choreo.chipReveal} manualAdd={manualAdd} />
                )}
              </Animated.View>
            )}
          </>
        )}
      </View>

      <ScanCameraModal {...camera} hint={t("scanner.pointAtFridge")} />

      <PhotoViewerModal
        open={photoViewerOpen}
        uri={fridgePhoto}
        onClose={() => setPhotoViewerOpen(false)}
      />

      <ScanMoreSheet anchor={scanMoreAnchor} />
    </>
  );
}
