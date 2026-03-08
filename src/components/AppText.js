import React from "react";
import { Text } from "react-native";
import { fonts } from "../theme/fonts";

export default function AppText({
  children,
  style,
  font = "regular",
  ...props
}) {
  return (
    <Text
      style={[
        { fontFamily: fonts[font] || fonts.regular },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
