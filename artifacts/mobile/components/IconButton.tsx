import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

type IconButtonProps = {
  icon?: React.ComponentProps<typeof Feather>["name"];
  label?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  size?: number;
  variant?: "ghost" | "solid" | "outline";
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  size = 36,
  variant = "ghost",
  active = false,
  style,
  testID,
  accessibilityLabel,
  disabled = false,
}: IconButtonProps) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  const bg =
    variant === "solid"
      ? c.accent
      : active
        ? c.surface
        : variant === "outline"
          ? "transparent"
          : "transparent";
  const fg =
    variant === "solid"
      ? c.background
      : active
        ? c.accent
        : c.text;
  const borderColor = variant === "outline" ? c.border : "transparent";
  const borderWidth = variant === "outline" ? 1 : 0;

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? label ?? icon}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minWidth: size,
          height: size,
          borderRadius: size / 2,
          paddingHorizontal: label ? 12 : 0,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderColor,
          borderWidth,
          opacity: pressed ? 0.6 : disabled ? 0.4 : 1,
          flexDirection: "row",
          gap: 6,
        },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={Math.round(size * 0.5)} color={fg} /> : null}
      {label ? (
        <Text
          style={{
            color: fg,
            fontSize: 14,
            fontWeight: "500",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Divider() {
  const { activeTheme } = useTheme();
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: activeTheme.colors.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
});
