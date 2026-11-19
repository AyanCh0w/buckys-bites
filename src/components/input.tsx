import { StyleSheet, TextInput } from "react-native";
import { fontFamily, secondaryFont } from "../lib/fonts";
import { useTheme } from "../state/ThemeProvider";
import type { InputProps } from "./input.types";

export function Input({ style, ...props }: InputProps) {
  const { colors, s, scheme } = useTheme();
  const textStyle = StyleSheet.flatten(style);
  const fontSize = textStyle?.fontSize ?? 17;
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      keyboardAppearance={scheme}
      selectionColor={colors.accent}
      {...props}
      style={[
        s.input,
        style,
        {
          fontFamily: /numeric|decimal|phone|number-pad/.test(
            props.keyboardType ?? "",
          )
            ? secondaryFont
            : fontFamily(textStyle?.fontWeight),
          fontSize,
          lineHeight: fontSize === 17 ? 24 : undefined,
        },
      ]}
    />
  );
}
