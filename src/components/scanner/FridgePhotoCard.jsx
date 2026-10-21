import React from "react";
import { Animated, Platform, Image, Text, TouchableOpacity, View } from "react-native";
import { CheckCircle2 } from "../../icons";
import { LinearGradient } from "expo-linear-gradient";
import PerfectCloseButton from "../PerfectCloseButton";
import ScanLaserOverlay from "../ScanLaserOverlay";
import { translateCount } from "../../i18n";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useScan } from "../../context/ScanContext";
import { useInventory } from "../../context/InventoryContext";

/** The scanned photo: laser overlay while scanning, then the compact header with the items-found badge, Scan More and start-over controls. */
export default function FridgePhotoCard({
  completionFlash,
  foodCount,
  handleScanMore,
  hasFood,
  ingredientsOpacity,
  ingredientsTranslate,
  photoHeightAnim,
  scanDisplayHeight,
  scanMoreButtonRef,
  scanStage,
  setPhotoViewerOpen,
  startScanAgain,
}) {
  const { t, recipeLanguageId } = useLanguage();
  const { colors } = useTheme();
  const { fridgePhoto } = useScan();
  const { scanIsDemo } = useInventory();
  return (
    <Animated.View
      style={[
        {
          height: photoHeightAnim,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: "#1E293B",
          marginBottom: 0,
          position: "relative",
        },
        // Shadow purge: this View also sets overflow:"hidden" for its
        // rounded corners, and iOS shadows + clipsToBounds on the same
        // native layer is a documented conflict — clipping needs
        // clipsToBounds=true, shadows need it false. Combined with an
        // animated height, this was rendering as an unpredictable
        // stray shadow band elsewhere in the scroll instead of a
        // clean glow under the photo. Drop the shadow entirely rather
        // than fight the conflict.
        Platform.select({
          ios: {
            shadowColor: "transparent",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
          },
          android: { elevation: 0 },
        }),
      ]}
    >
      <TouchableOpacity
        activeOpacity={scanStage === "completed" ? 0.85 : 1}
        disabled={scanStage !== "completed"}
        onPress={() => setPhotoViewerOpen(true)}
        accessibilityLabel={t("a11y.viewFridgePhoto")}
        accessibilityRole="button"
        style={{ width: "100%", height: "100%" }}
      >
        <Image
          source={{ uri: fridgePhoto }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </TouchableOpacity>

      {/* A light fridge photo (white door, bright shelf) is nearly the page
          colour, so its edge and rounded corners vanished and the white
          Close / Scan More buttons looked like they floated past the
          photo. A soft dark scrim behind the top controls keeps them
          readable, and a hairline outline restores the photo's shape. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(15, 23, 42, 0.38)", "rgba(15, 23, 42, 0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 72 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.photoBorder,
        }}
      />

      {/* 60fps Reanimated laser — UI thread, never blocks Gemini */}
      <ScanLaserOverlay
        active={scanStage === "scanning"}
        travelDistance={Math.max(scanDisplayHeight - 32, 80)}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#FFFFFF",
          opacity: completionFlash,
          zIndex: 15,
        }}
      />

      {scanStage === "completed" && hasFood ? (
        // This count is the actual proof the scan worked — the most
        // important confirmation on this screen — so it gets a
        // solid brand-green badge with real weight, not a quiet
        // translucent chip that reads the same as any other label.
        //
        // Fades/rises in with the same ingredientsOpacity/
        // ingredientsTranslate values driving the ingredient-pill
        // card below, instead of popping in instantly. Confirmed
        // real complaint: this badge used to be a plain View with
        // no animation at all, so it snapped into existence on the
        // exact same frame the photo was mid-shrink — while the
        // ingredient list beneath it was already fading in smoothly
        // — and that mismatch is what read as "instant/too fast"
        // right after a scan, even though the actual shrink/reveal
        // motion itself takes a few hundred ms.
        <Animated.View
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 20,
            backgroundColor: "#059669",
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
            maxWidth: "60%",
            opacity: ingredientsOpacity,
            transform: [{ translateY: ingredientsTranslate }],
          }}
        >
          <CheckCircle2 size={12} color="#FFFFFF" />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: "700",
              marginLeft: 5,
            }}
            numberOfLines={1}
          >
            {foodCount === 1
              ? t("scanner.itemsFoundOne", { count: foodCount })
              : translateCount(recipeLanguageId, foodCount, {
                  few: "scanner.itemsFoundFew",
                  many: "scanner.itemsFoundMany",
                  fallback: "scanner.itemsFoundOther",
                })}
          </Text>
        </Animated.View>
      ) : null}

      {/* With nothing detected, Take Photo / From Gallery in the card below
          already do what Scan More would, so it would only be a duplicate. */}
      {scanStage === "completed" && hasFood && !scanIsDemo ? (
        <TouchableOpacity
          ref={scanMoreButtonRef}
          onPress={handleScanMore}
          activeOpacity={0.85}
          accessibilityLabel={t("a11y.scanMoreShelves")}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 30,
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(226, 232, 240, 0.95)",
            // Same fade/rise as the badge above — see its comment.
            // TouchableOpacity renders its own Animated.View under
            // the hood, so an Animated.Value here animates exactly
            // like it would on a plain Animated.View.
            opacity: ingredientsOpacity,
            transform: [{ translateY: ingredientsTranslate }],
          }}
        >
          <Text
            style={{
              color: "#0F172A",
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.2,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {t("scanner.scanMore")}
          </Text>
        </TouchableOpacity>
      ) : null}

      <PerfectCloseButton
        isFullScreen={false}
        corner="left"
        onPress={startScanAgain}
        accessibilityLabel={t("a11y.dismissFridgePhoto")}
      />
    </Animated.View>
  );
}
