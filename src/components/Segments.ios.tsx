import { useTheme } from "../state/ThemeProvider";
import { Host } from "@expo/ui";
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
  return (
    <Host
      colorScheme={scheme}
      matchContents={{ vertical: true }}
      seedColor={colors.accent}
      style={{ minHeight: 36 }}
    >
      <Picker
        selection={value}
        onSelectionChange={onChange}
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
