import { useLayoutEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Host, TextInput, useNativeState } from "@expo/ui";
import { font, frame, textFieldStyle } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../state/ThemeProvider";
import type { InputProps } from "./input.types";

export function Input({ value, style, onChangeText, ...props }: InputProps) {
  const { colors, s, scheme } = useTheme();
  const text = useNativeState(value ?? props.defaultValue ?? "");
  const lastText = useRef(value ?? props.defaultValue ?? "");

  useLayoutEffect(() => {
    // Native typing already updates the field. Only write external changes,
    // such as restoring general goals, so typing doesn't reset the selection.
    if (value !== undefined && value !== lastText.current) {
      lastText.current = value;
      text.set(value);
    }
  }, [text, value]);

  const {
    color,
    fontSize,
    fontFamily: _fontFamily,
    fontWeight: _fontWeight,
    lineHeight: _lineHeight,
    textAlign,
    textAlignVertical: _textAlignVertical,
    height,
    minHeight = 50,
    padding = 0,
    paddingHorizontal = padding,
    paddingVertical = padding,
    paddingTop = paddingVertical,
    paddingBottom = paddingVertical,
    paddingLeft = paddingHorizontal,
    paddingRight = paddingHorizontal,
    ...containerStyle
  } = { ...s.input, ...StyleSheet.flatten(style) };
  const minimumHeight = typeof height === "number" ? height : Number(minHeight);
  const contentHeight = Math.max(
    0,
    minimumHeight -
      Number(paddingTop) -
      Number(paddingBottom) -
      2 * (containerStyle.borderWidth ?? 0),
  );

  return (
    <View style={[containerStyle, { minHeight: minimumHeight }]}>
      <Host
        colorScheme={scheme}
        seedColor={colors.accent}
        ignoreSafeArea="all"
        matchContents={{ vertical: true }}
        style={{ alignSelf: "stretch" }}
      >
        <TextInput
          {...props}
          value={text}
          onChangeText={(next) => {
            lastText.current = next;
            onChangeText?.(next);
          }}
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          textAlign={
            textAlign === "start"
              ? "left"
              : textAlign === "end"
                ? "right"
                : textAlign
          }
          numberOfLines={
            props.multiline ? (props.numberOfLines ?? 3) : undefined
          }
          style={{ paddingTop, paddingBottom, paddingLeft, paddingRight }}
          textStyle={{ color: typeof color === "string" ? color : colors.ink }}
          modifiers={[
            textFieldStyle("plain"),
            // Keep editable text, placeholder, caret and selection on the same
            // native font metrics. Brand fonts remain on the surrounding UI.
            font({ textStyle: (fontSize ?? 17) >= 28 ? "title" : "body" }),
            frame({
              minHeight: contentHeight,
              alignment: props.multiline ? "topLeading" : "leading",
            }),
          ]}
        />
      </Host>
    </View>
  );
}
