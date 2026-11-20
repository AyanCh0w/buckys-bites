import { useTheme } from "../state/ThemeProvider";
import { Host } from "@expo/ui";
import { useHaptic } from "../lib/haptics";
import { Picker, Text } from "@expo/ui/swift-ui";
import { disabled, font, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

export default function Segments({
  values,
  value,
  onChange,
  disabledValues = [],
}: {
  values: string[];
  value: string;
  onChange: (value: string) => void;
  disabledValues?: string[];
}) {
  const { colors, scheme } = useTheme();
  const playHaptic = useHaptic();
  return (
    <Host
      colorScheme={scheme}
      ignoreSafeArea="all"
      seedColor={colors.accent}
      style={{ height: 36, flexShrink: 0 }}
    >
      <Picker
        selection={value}
        onSelectionChange={(next) => {
          if (next === value || disabledValues.includes(next)) return;
          playHaptic("select");
          onChange(next);
        }}
        modifiers={[pickerStyle("segmented")]}
      >
        {values.map((x) => (
          <Text
            key={x}
            modifiers={[
              tag(x),
              disabled(disabledValues.includes(x)),
              font({
                family: "HelveticaNeue-MediumCond",
                size: 14,
                textStyle: "body",
              }),
            ]}
          >
            {x}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
