import React from "react";
import { Text } from "react-native";
import { fonts } from "../theme/fonts";

export default function AppText({
  children,
  style,
  font = "regular",
}) {
  return (
    <Text
      style={[
        { fontFamily: fonts[font] || fonts.regular, color: "#1a1a1a" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
