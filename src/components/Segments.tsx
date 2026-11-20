import { useTheme } from "../state/ThemeProvider";
import { Text, View } from "react-native";
import { Tap } from "./Tap";

import { secondaryFont } from "../lib/fonts";
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
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 3,
        borderRadius: 10,
        backgroundColor: colors.canvas,
        gap: 2,
      }}
    >
      {values.map((x) => (
        <Tap
          key={x}
          haptic={x === value ? false : "select"}
          highlightRadius={8}
          onPress={() => onChange(x)}
          disabled={disabledValues.includes(x)}
          accessibilityRole="tab"
          accessibilityState={{
            selected: x === value,
            disabled: disabledValues.includes(x),
          }}
          style={{ flex: 1 }}
          contentStyle={{
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            backgroundColor: value === x ? colors.selected : "transparent",
            boxShadow: value === x ? "0 1px 4px #0001" : undefined,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontFamily: secondaryFont,
              color: value === x ? colors.ink : colors.muted,
            }}
          >
            {x}
          </Text>
        </Tap>
      ))}
    </View>
  );
}
