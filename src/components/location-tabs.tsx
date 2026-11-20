import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state/AppProvider";
import { ScrollView, View } from "react-native";
import {
  campusCafeStatus,
  diningLocations,
  locationCatalog,
  type DiningLocation,
} from "../lib/dining-locations";
import { browsingCatalog, kitchenMenus } from "../lib/menu";
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
  const { catalog } = useApp();
  const [now, setNow] = useState(() => new Date());
  const benson = useMemo(
    () => browsingCatalog(locationCatalog(catalog, "benson")),
    [catalog],
  );
  const bensonClosed = useMemo(
    () =>
      benson.stations.length > 0 &&
      kitchenMenus(benson, now).every((kitchen) => !kitchen.open),
    [benson, now],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
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
          const closed =
            location.key === "benson"
              ? bensonClosed
              : campusCafeStatus(catalog, location.key, now).hours?.open ===
                false;
          return (
            <Tap
              key={location.key}
              padding="none"
              accessibilityRole="tab"
              accessibilityLabel={`${location.name}, ${location.building}${closed ? ", closed" : ""}`}
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
              <Art
                name={`cafes/${location.art}`}
                size={44}
                style={{ opacity: closed ? 0.35 : 1 }}
              />
              <T
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active && !closed ? colors.accent : colors.muted,
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
