import { ScrollView, View } from "react-native";
import { diningLocations, type DiningLocation } from "../lib/dining-locations";
import { useTheme } from "../state/ThemeProvider";
import { Art, T, Tap } from "./ui";

export function LocationTabs({
  selected,
  onSelect,
}: {
  selected: DiningLocation;
  onSelect: (location: DiningLocation) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderColor: colors.rule }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12 }}
      >
        {diningLocations.map((location) => {
          const active = selected.key === location.key;
          return (
            <Tap
              key={location.key}
              padding="none"
              accessibilityRole="tab"
              accessibilityLabel={`${location.name}, ${location.building}`}
              aria-selected={active}
              accessibilityState={{ selected: active }}
              haptic={active ? false : "select"}
              style={{ flexGrow: 1 }}
              contentStyle={{
                alignItems: "center",
                paddingHorizontal: 6,
                paddingTop: 2,
                paddingBottom: 6,
                borderBottomWidth: 2,
                borderBottomColor: active ? colors.accent : "transparent",
              }}
              onPress={() => onSelect(location)}
            >
              <Art name={`cafes/${location.art}`} size={44} />
              <T
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active ? colors.accent : colors.muted,
                }}
              >
                {location.label}
              </T>
            </Tap>
          );
        })}
      </ScrollView>
    </View>
  );
}
