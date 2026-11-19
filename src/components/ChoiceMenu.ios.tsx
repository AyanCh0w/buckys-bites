import { useTheme } from "../state/ThemeProvider";
import { Host, RNHostView } from "@expo/ui";
import { Menu, Button } from "@expo/ui/swift-ui";
import { font, tint } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { Icon, T } from "./ui";

import type { ChoiceMenuProps } from "./ChoiceMenu.types";

export default function ChoiceMenu({
  label,
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: ChoiceMenuProps) {
  const { colors, scheme } = useTheme();
  return (
    <Host colorScheme={scheme} matchContents style={{ minHeight: 44 }}>
      <Menu
        label={
          <RNHostView matchContents>
            <View
              accessible
              accessibilityLabel={accessibilityLabel ?? label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                minHeight: 44,
                paddingHorizontal: 4,
              }}
            >
              <T style={{ fontSize: 13, fontWeight: "600" }}>{label}</T>
              <Icon name="chevron-down" size={11} color={colors.muted} />
            </View>
          </RNHostView>
        }
        modifiers={[
          tint(colors.ink),
          font({ family: "BDOGrotesk-Medium", textStyle: "body", size: 17 }),
        ]}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            label={option.label}
            systemImage={selected === option.value ? "checkmark" : undefined}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </Menu>
    </Host>
  );
}
