import { useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { kitchenHours } from "../lib/availability";
import {
  campusMenuEntries,
  type DiningLocation,
} from "../lib/dining-locations";
import { campusDate } from "../lib/domain";
import { CafeMenu } from "./cafe-menu";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { EmptyState, T } from "./ui";

export function CampusMenu({ location }: { location: DiningLocation }) {
  const { catalog, data, refreshing, refresh, syncError } = useApp();
  const { s, colors } = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const date = campusDate(now);
  const services = useMemo(() => {
    const cafe = catalog.cafes.find((c) => c.source_key === location.key);
    return catalog.services.filter((service) => service.cafe_id === cafe?.id);
  }, [catalog, location]);
  const today = services.filter((service) => service.service_date === date);
  const closure = today.find((service) => service.status === "closed");
  const hasMenu = today.some((service) => service.status === "published");
  const hours = closure
    ? (closure.closure_message ?? "Closed today")
    : hasMenu
      ? kitchenHours(services, now).label
      : undefined;
  const [category, setCategory] = useState("");
  const items = useMemo(
    () =>
      campusMenuEntries(catalog, location.key, date, data.profile.dietary).map(
        ({ food, offering, service }) => ({
          food,
          offering,
          meal: service.name === "All Day" ? undefined : service.name,
        }),
      ),
    [catalog, location, date, data.profile.dietary],
  );
  const filtered = hasMenu && data.profile.dietary.length > 0;
  return (
    <CafeMenu
      tab
      items={items}
      date={date}
      category={category}
      onSelect={setCategory}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.accent}
        />
      }
    >
      <View style={{ marginTop: 16, marginBottom: 6, gap: 2 }}>
        <T accessibilityRole="header" style={s.sectionTitle}>
          {location.name}
        </T>
        <T style={s.caption}>
          {location.building}
          {hours ? ` · ${hours}` : ""}
        </T>
        {syncError && <T style={s.caption}>{syncError}</T>}
      </View>
      {!items.length && (
        <EmptyState
          title={
            closure
              ? "Closed"
              : filtered
                ? "No Matching Meals"
                : "No Dishes Listed"
          }
          text={
            closure?.closure_message ??
            (filtered
              ? "You can change your dietary preferences in Nutrition settings."
              : "There’s no menu saved for this café today.")
          }
        />
      )}
    </CafeMenu>
  );
}
