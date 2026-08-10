import React from "react";
import { View, Text } from "react-native";
import { Sparkles, Infinity as InfinityIcon, ChefHat, ShieldCheck, Check } from "lucide-react-native";

import { ModalSheet } from "@/components/ModalSheet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/constants/theme";
import { closeModal } from "@/utils/navigation";

const PERKS = [
  { icon: InfinityIcon, label: "Unlimited fridge scans" },
  { icon: ChefHat, label: "Unlimited recipe generations" },
  { icon: ShieldCheck, label: "Priority AI accuracy" },
];

export default function ProModal() {
  return (
    <ModalSheet
      title="CookSnap Pro"
      onClose={closeModal}
      footer={
        <View>
          <PrimaryButton label="Start 7-Day Free Trial" onPress={closeModal} />
          <Text className="text-slate-400 text-xs text-center mt-3">
            $4.99/mo after trial · Cancel anytime
          </Text>
        </View>
      }
    >
      <View className="items-center py-4 mb-6">
        <View className="w-16 h-16 rounded-full bg-accent-butter items-center justify-center mb-4">
          <Sparkles size={26} color={colors.slate} />
        </View>
        <Text className="text-slate-950 text-2xl font-extrabold text-center mb-1">
          Cook without limits
        </Text>
        <Text className="text-slate-500 text-base text-center">
          Everything CookSnap can do, unlocked.
        </Text>
      </View>

      <View className="rounded-3xl overflow-hidden mb-6" style={{ borderWidth: 1.5, borderColor: colors.slate }}>
        <View className="bg-slate-950 px-5 py-3">
          <Text className="text-white font-bold text-xs uppercase tracking-wide">
            Most Popular
          </Text>
        </View>
        <View className="bg-white px-5 py-4">
          <View className="flex-row items-baseline">
            <Text className="text-slate-950 text-3xl font-extrabold">$4.99</Text>
            <Text className="text-slate-500 text-base ml-1">/ month</Text>
          </View>
          <Text className="text-slate-500 text-sm mt-0.5">7 days free, then billed monthly</Text>
        </View>
      </View>

      {PERKS.map(({ icon: Icon, label }) => (
        <View key={label} className="flex-row items-center bg-white rounded-2xl px-4 py-4 mb-2.5">
          <View className="w-9 h-9 rounded-full bg-accent-mint items-center justify-center mr-3">
            <Icon size={16} color={colors.slate} />
          </View>
          <Text className="text-slate-950 font-semibold flex-1">{label}</Text>
          <Check size={18} color={colors.success} />
        </View>
      ))}
    </ModalSheet>
  );
}
