import React, { useEffect } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors, MODAL_HEIGHT_PERCENT } from "@/constants/theme";

interface ModalSheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * The "Golden Template" — every modal (Shopping List, Planner, Pro, Recipe
 * Detail) uses this: 80% height, edge-to-edge backdrop, no header shadow,
 * scrollable body. The backdrop fades in over 250ms so it never "snaps" in
 * alongside expo-router's slide-up transition of the card.
 */
export function ModalSheet({ title, onClose, children, footer }: ModalSheetProps) {
  const { height } = useWindowDimensions();
  const sheetHeight = height * MODAL_HEIGHT_PERCENT;
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.value = withTiming(1, { duration: 250 });
  }, [backdropOpacity]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View className="flex-1 justify-end">
      <Animated.View
        className="absolute inset-0"
        style={[{ backgroundColor: "rgba(15,23,42,0.55)" }, backdropStyle]}
      />
      <Pressable className="absolute inset-0" onPress={onClose} />
      <View
        style={{ height: sheetHeight }}
        className="bg-offwhite rounded-t-[28px] overflow-hidden"
      >
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
          <Text className="text-slate-950 text-2xl font-extrabold">{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="w-9 h-9 rounded-full bg-slate-950/5 items-center justify-center active:opacity-80"
          >
            <X size={18} color={colors.slate} />
          </Pressable>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View className="px-6 pb-8 pt-2 bg-offwhite">{footer}</View> : null}
      </View>
    </View>
  );
}
