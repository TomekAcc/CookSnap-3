import React from "react";
import { View, Text, Pressable } from "react-native";
import { RefreshCw } from "lucide-react-native";
import { colors } from "@/constants/theme";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) {
      console.warn("CookSnap recovered from a render error:", error);
    }
  }

  handleRecover = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-offwhite px-8">
          <View className="w-20 h-20 rounded-full bg-accent-coral items-center justify-center mb-6">
            <RefreshCw size={32} color={colors.slate} />
          </View>
          <Text className="text-slate-950 text-xl font-bold mb-2 text-center">
            Something slipped in the kitchen
          </Text>
          <Text className="text-slate-500 text-base text-center mb-8">
            CookSnap hit a snag. Give it another go.
          </Text>
          <Pressable
            onPress={this.handleRecover}
            className="bg-slate-950 rounded-full px-8 py-4 active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">Recover</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
