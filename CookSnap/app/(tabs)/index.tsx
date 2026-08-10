import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { View, Text, Pressable, useWindowDimensions, ScrollView, Modal, TextInput } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { router, useNavigation } from "expo-router";
import {
  Camera,
  Images,
  ArrowRight,
  RotateCcw,
  Refrigerator,
  Package,
  PackageSearch,
  X,
  Plus,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing, FadeIn } from "react-native-reanimated";

import { Header } from "@/components/Header";
import { ScanLaserOverlay } from "@/components/ScanLaserOverlay";
import { ScanProgressBar } from "@/components/ScanProgressBar";
import { IngredientPill } from "@/components/IngredientPill";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/constants/theme";
import { getTabBarStyle } from "@/constants/tabBarStyle";
import { detectIngredientsFromPhoto } from "@/services/visionService";
import { prepareImageForVision } from "@/utils/imageProcessing";
import { mergeIngredients } from "@/utils/mergeIngredients";
import { usePantry } from "@/context/PantryContext";
import { Ingredient, ScanMode, ScanPhase } from "@/types";

const THUMB_HEIGHT = 160;
const CARD_MARGIN = 20;
const CARD_RADIUS = 24; // rounded-3xl
const SCAN_CARD_HEIGHT_RATIO = 0.6;

export default function ScannerScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { addScannedIngredients } = usePantry();

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [scanMode, setScanMode] = useState<ScanMode>("fridge");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [detected, setDetected] = useState<Ingredient[]>([]);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [manualName, setManualName] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Container height tracks the actual captured photo's aspect ratio (clamped
  // to a sane range) instead of a fixed percentage — no cropping, no
  // letterboxing. Recomputed per-photo in runScan since it depends on the
  // photo's own dimensions, which aren't known until capture/pick resolves.
  const [cardHeight, setCardHeight] = useState(height * SCAN_CARD_HEIGHT_RATIO);
  const photoHeight = useSharedValue(cardHeight);

  const photoAnimatedStyle = useAnimatedStyle(() => ({
    height: photoHeight.value,
  }));

  // Zero clutter: the bottom tab bar is part of the parent navigator, not
  // this screen, so hiding it during the immersive scan has to go through
  // navigation.setOptions rather than a local style. Restored to the exact
  // shared style (not a bare default) so it doesn't flash unstyled.
  const isImmersive = phase === "scanning" || phase === "populating";
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: isImmersive ? { display: "none" } : getTabBarStyle(insets.bottom),
    });
  }, [isImmersive, insets.bottom, navigation]);

  const runScan = useCallback(
    async (rawUri: string, aspectRatio: number) => {
      // Container height derived from the actual photo's aspect ratio, clamped
      // to a sane range — computed synchronously here (not via state + effect)
      // so the very first frame already uses the right height, no jump.
      const containerWidth = width - CARD_MARGIN * 2;
      const naturalHeight = containerWidth / aspectRatio;
      const nextCardHeight = Math.min(Math.max(naturalHeight, height * 0.35), height * 0.75);
      setCardHeight(nextCardHeight);

      // Instant visual feedback — the just-captured photo appears the moment
      // scanning starts. Resizing/compressing for the network request happens
      // in the background and never blocks what's on screen.
      setPhase("scanning");
      setPhotoUri(rawUri);
      photoHeight.value = nextCardHeight;

      try {
        const { base64 } = await prepareImageForVision(rawUri);
        const items = await detectIngredientsFromPhoto(base64, scanMode);
        // Merge — never duplicate an item already found earlier in this session.
        setDetected((prev) => mergeIngredients(prev, items));
      } catch (error) {
        // Honest failure, no mock fallback: a missing API key, network error,
        // or a genuinely empty photo all land here. Whatever was already
        // merged from an earlier scan this session is preserved — this
        // attempt just contributes nothing rather than fabricating data.
        console.warn("[CookSnap Scanner] Scan failed:", error);
      }

      setPhase("populating");
      photoHeight.value = withTiming(THUMB_HEIGHT, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
      setTimeout(() => {
        setPhase("done");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 520);
    },
    [width, height, scanMode]
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("capturing");
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      if (photo) {
        await runScan(photo.uri, photo.width / photo.height);
      }
    } catch {
      setPhase("idle");
    }
  }, [runScan]);

  const handlePickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await runScan(asset.uri, asset.width / asset.height);
    }
  }, [runScan]);

  // Full reset — used once the session is committed to the pantry.
  const handleReset = useCallback(() => {
    setPhase("idle");
    setPhotoUri(null);
    setDetected([]);
    setShowManualInput(false);
    setManualName("");
  }, []);

  // Back to camera to scan another shelf — keeps the accumulated, deduplicated list.
  const handleScanMore = useCallback(() => {
    setPhase("idle");
    setPhotoUri(null);
  }, []);

  const handleAddToPantry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addScannedIngredients(detected);
    router.push("/pantry" as never);
    handleReset();
  }, [detected, addScannedIngredients, handleReset]);

  const handleSelectMode = useCallback((mode: ScanMode) => {
    Haptics.selectionAsync();
    setScanMode(mode);
  }, []);

  // No dead-ends: if the AI can't find anything (or anything more), the user
  // can always add an item by hand without losing whatever was already found.
  const handleAddManually = useCallback(() => {
    const name = manualName.trim();
    if (!name) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = Date.now();
    const manualItem: Ingredient = {
      id: `manual-${now}`,
      name,
      category: "other",
      status: "in_stock",
      isStaple: false,
      addedAt: now,
    };
    setDetected((prev) => mergeIngredients(prev, [manualItem]));
    setManualName("");
    setShowManualInput(false);
  }, [manualName]);

  if (phase === "idle" || phase === "capturing") {
    return (
      <View className="flex-1 bg-slate-950">
        <Header title="CookSnap" />

        <View className="flex-row mx-5 mb-3 bg-white/10 rounded-full p-1">
          <Pressable
            onPress={() => handleSelectMode("fridge")}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-full ${
              scanMode === "fridge" ? "bg-white" : ""
            }`}
          >
            <Refrigerator size={15} color={scanMode === "fridge" ? colors.slate : "#F8FAFC"} />
            <Text
              className={`ml-1.5 font-semibold text-sm ${
                scanMode === "fridge" ? "text-slate-950" : "text-white"
              }`}
            >
              Scan Fridge
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSelectMode("pantry")}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-full ${
              scanMode === "pantry" ? "bg-white" : ""
            }`}
          >
            <Package size={15} color={scanMode === "pantry" ? colors.slate : "#F8FAFC"} />
            <Text
              className={`ml-1.5 font-semibold text-sm ${
                scanMode === "pantry" ? "text-slate-950" : "text-white"
              }`}
            >
              Scan Pantry
            </Text>
          </Pressable>
        </View>

        <View className="flex-1 mx-5 rounded-3xl overflow-hidden bg-slate-950">
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          ) : (
            <View className="flex-1 items-center justify-center px-8 bg-slate-900">
              <Camera size={40} color="#B8F2E6" />
              <Text className="text-white text-lg font-bold mt-4 mb-2 text-center">
                Point CookSnap at your {scanMode === "fridge" ? "fridge" : "pantry shelf"}
              </Text>
              <Text className="text-slate-400 text-sm text-center mb-6">
                Camera access lets us scan ingredients instantly.
              </Text>
              <PrimaryButton label="Enable Camera" variant="light" onPress={requestPermission} />
            </View>
          )}
        </View>

        <View className="flex-row items-end justify-center px-8 py-8">
          <Pressable
            onPress={handlePickFromLibrary}
            className="items-center active:opacity-80"
            style={{ width: 64 }}
          >
            <View className="w-14 h-14 rounded-full bg-white/10 items-center justify-center mb-1.5">
              <Images size={22} color="#F8FAFC" />
            </View>
            <Text className="text-white/70 text-xs font-medium">Gallery</Text>
          </Pressable>

          <Pressable
            onPress={handleCapture}
            disabled={!permission?.granted || phase === "capturing"}
            className="w-20 h-20 rounded-full bg-white items-center justify-center mx-8 active:opacity-80"
            style={{ opacity: phase === "capturing" ? 0.6 : 1 }}
          >
            <View className="w-16 h-16 rounded-full border-2 border-slate-950" />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setFacing((f) => (f === "back" ? "front" : "back"));
            }}
            className="items-center active:opacity-80"
            style={{ width: 64 }}
          >
            <View className="w-14 h-14 rounded-full bg-white/10 items-center justify-center mb-1.5">
              <RotateCcw size={20} color="#F8FAFC" />
            </View>
            <Text className="text-white/70 text-xs font-medium">Flip</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`flex-1 ${phase === "done" ? "bg-offwhite" : "bg-slate-950 justify-center"}`}
    >
      {phase === "done" ? <Header title="CookSnap" subtitle="Scan results" /> : null}

      <Pressable
        onPress={() => setIsPhotoExpanded(true)}
        disabled={phase !== "done"}
        className={phase === "done" ? "active:opacity-80" : undefined}
      >
        <Animated.View
          style={[
            photoAnimatedStyle,
            {
              marginHorizontal: CARD_MARGIN,
              borderRadius: CARD_RADIUS,
              overflow: "hidden",
              backgroundColor: colors.slate,
            },
          ]}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              blurRadius={phase === "scanning" ? 14 : 0}
              transition={200}
            />
          ) : null}
          {phase === "scanning" ? <ScanLaserOverlay height={cardHeight} /> : null}
          {phase === "scanning" ? <ScanProgressBar /> : null}
        </Animated.View>
      </Pressable>

      {/* Tap-to-expand — verify exactly what Gemini saw, full screen, uncropped. */}
      <Modal visible={isPhotoExpanded} transparent animationType="fade">
        <View className="flex-1 bg-slate-950/95 items-center justify-center">
          <Pressable
            onPress={() => setIsPhotoExpanded(false)}
            hitSlop={12}
            style={{ position: "absolute", top: insets.top + 16, right: 20, zIndex: 10 }}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
          >
            <X size={20} color="#fff" />
          </Pressable>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={{ width: "100%", height: "80%" }}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Modal>

      {phase === "done" ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
          {detected.length === 0 ? (
            <View className="items-center justify-center py-16">
              <View className="w-16 h-16 rounded-full bg-slate-950/5 items-center justify-center mb-4">
                <PackageSearch size={28} color={colors.textMuted} />
              </View>
              <Text className="text-slate-950 text-lg font-bold mb-1">No Ingredients Detected</Text>
              <Text className="text-slate-500 text-sm text-center px-8">
                CookSnap couldn't identify anything in that photo. Try again with a clearer, closer
                shot of the shelf.
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-slate-950 text-lg font-bold mb-1">
                Found {detected.length} item{detected.length === 1 ? "" : "s"}
              </Text>
              <Text className="text-slate-500 text-sm mb-5">
                Tap any item to mark it out of stock before adding.
              </Text>
              <Animated.View
                entering={FadeIn.duration(300)}
                className="flex-row flex-wrap"
                style={{ gap: 8 }}
              >
                {detected.map((item) => (
                  <IngredientPill
                    key={item.id}
                    ingredient={item}
                    onToggle={(id) =>
                      setDetected((prev) =>
                        prev.map((i) =>
                          i.id === id
                            ? { ...i, status: i.status === "in_stock" ? "out_of_stock" : "in_stock" }
                            : i
                        )
                      )
                    }
                  />
                ))}
              </Animated.View>
            </>
          )}

          {/* No dead-ends: manual entry is always one tap away, whether the
              scan found nothing or the user just wants to add something the
              AI missed. */}
          <View className="mt-6">
            {showManualInput ? (
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <TextInput
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="e.g. Milk"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  onSubmitEditing={handleAddManually}
                  returnKeyType="done"
                  className="flex-1 bg-white rounded-full px-4 py-3 text-slate-950"
                />
                <Pressable
                  onPress={handleAddManually}
                  className="w-12 h-12 rounded-full bg-slate-950 items-center justify-center active:opacity-80"
                >
                  <Plus size={20} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowManualInput(true)}
                className="flex-row items-center justify-center py-3 rounded-full border border-dashed border-slate-950/15 active:opacity-80"
              >
                <Plus size={16} color={colors.textMuted} />
                <Text className="ml-1.5 text-slate-500 font-semibold text-sm">
                  Add Ingredient Manually
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      ) : null}

      {phase === "done" ? (
        <View className="px-5 pb-8 pt-3 bg-offwhite flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <PrimaryButton label="Scan More" variant="light" onPress={handleScanMore} />
          </View>
          <View className="flex-1">
            <PrimaryButton
              label="Add to Pantry"
              onPress={handleAddToPantry}
              icon={<ArrowRight size={18} color="#fff" />}
              disabled={detected.length === 0}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
