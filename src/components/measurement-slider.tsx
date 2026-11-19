import React from "react";
import Slider from "@expo/ui/community/slider";
import { useTheme } from "../state/ThemeProvider";

export type MeasurementSliderProps = {
  label: string;
  displayValue: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

// The universal Slider lacks web accessibility labels; Expo's adapter has them.
export default function MeasurementSlider(props: MeasurementSliderProps) {
  const { colors } = useTheme();
  return (
    <Slider
      value={props.value}
      minimumValue={props.min}
      maximumValue={props.max}
      step={1}
      disabled={props.disabled}
      onValueChange={(value) => props.onChange(Math.round(value))}
      accessibilityLabel={`${props.label}: ${props.displayValue}`}
      minimumTrackTintColor={colors.accent}
      maximumTrackTintColor={colors.rule}
      style={{ width: "100%", height: 44, margin: 0 }}
      testID={`goal-${props.label.toLowerCase().replaceAll(" ", "-")}`}
    />
  );
}
