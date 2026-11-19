import React from "react";
import { Host, Slider } from "@expo/ui";
import {
  accessibilityLabel,
  accessibilityValue,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "../state/ThemeProvider";
import type { MeasurementSliderProps } from "./measurement-slider";

export default function MeasurementSlider(props: MeasurementSliderProps) {
  const { colors, scheme } = useTheme();
  return (
    <Host
      colorScheme={scheme}
      seedColor={colors.accent}
      ignoreSafeArea="all"
      style={{ width: "100%", height: 44 }}
    >
      <Slider
        value={props.value}
        min={props.min}
        max={props.max}
        step={1}
        disabled={props.disabled}
        onValueChange={(value) => props.onChange(Math.round(value))}
        modifiers={[
          accessibilityLabel(props.label),
          accessibilityValue(props.displayValue),
        ]}
        testID={`goal-${props.label.toLowerCase().replaceAll(" ", "-")}`}
      />
    </Host>
  );
}
