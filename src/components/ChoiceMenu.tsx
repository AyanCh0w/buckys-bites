import { useTheme } from "../state/ThemeProvider";
import React, { useRef, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Icon, T, Tap } from "./ui";
import { useHaptic } from "../lib/haptics";

import type { ChoiceMenuProps } from "./ChoiceMenu.types";

export default function ChoiceMenu({
  label,
  options,
  selected,
  onSelect,
  accessibilityLabel,
}: ChoiceMenuProps) {
  const { colors, s } = useTheme();
  const playHaptic = useHaptic();
  const anchor = useRef<React.ElementRef<typeof View>>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const { width, height } = useWindowDimensions();
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Tap
          padding="none"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ expanded: Boolean(position) }}
          onPress={() =>
            anchor.current?.measureInWindow((x, y, w, h) =>
              setPosition({
                x: Math.max(12, Math.min(x, width - 226)),
                y: Math.min(y + h + 4, height - options.length * 46 - 20),
              }),
            )
          }
        >
          <View
            style={{
              minHeight: 44,
              paddingHorizontal: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <T style={{ fontSize: 13, fontWeight: "600" }}>{label}</T>
            <Icon name="chevron-down" size={11} color={colors.muted} />
          </View>
        </Tap>
      </View>
      <Modal
        transparent
        visible={Boolean(position)}
        animationType="fade"
        onRequestClose={() => setPosition(null)}
      >
        <Pressable
          accessibilityLabel="Close menu"
          style={{ flex: 1 }}
          onPress={() => {
            playHaptic("release");
            setPosition(null);
          }}
        >
          <View
            accessibilityRole="menu"
            style={{
              position: "absolute",
              top: position?.y ?? 0,
              left: position?.x ?? 0,
              width: 214,
              backgroundColor: colors.paper,
              borderRadius: 14,
              padding: 5,
              boxShadow: "0 6px 30px #0002",
            }}
          >
            {options.map((option) => (
              <Tap
                padding="none"
                key={option.value}
                haptic={selected === option.value ? "release" : "select"}
                highlightRadius={10}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: selected === option.value }}
                onPress={() => {
                  setPosition(null);
                  onSelect(option.value);
                }}
              >
                <View
                  style={[s.between, { paddingHorizontal: 12, minHeight: 46 }]}
                >
                  <T style={{ fontSize: 15 }}>{option.label}</T>
                  {selected === option.value && (
                    <Icon name="checkmark" size={17} color={colors.accent} />
                  )}
                </View>
              </Tap>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
