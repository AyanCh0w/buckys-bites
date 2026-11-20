import { useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import {
  campusCafeStatus,
  campusMenuEntries,
  type DiningLocation,
} from "../lib/dining-locations";
import { campusDate } from "../lib/domain";
import { CafeCategory, CafeMenu } from "./cafe-menu";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { EmptyState, T } from "./ui";

export function CampusMenu({
  location,
  category,
}: {
  location: DiningLocation;
  category?: string;
}) {
  const { catalog, data, refreshing, refresh, syncError } = useApp();
  const { s, colors } = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const date = campusDate(now);
  const { closure, hasMenu, hours } = campusCafeStatus(
    catalog,
    location.key,
    now,
  );
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
  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
      tintColor={colors.accent}
    />
  );
  if (category) {
    return (
      <CafeCategory
        category={category}
        cafeName={location.name}
        items={items}
        date={date}
        refreshControl={refreshControl}
      />
    );
  }
  return (
    <CafeMenu
      tab
      collage
      closed={hours?.open === false}
      items={items}
      categoryHref={(category) => ({
        pathname: "/cafe/[key]/[category]",
        params: { key: location.key, category },
      })}
      refreshControl={refreshControl}
    >
      <View style={{ marginTop: 16, marginBottom: 6, gap: 2 }}>
        <T accessibilityRole="header" style={s.sectionTitle}>
          {location.name}
        </T>
        <T style={s.caption}>
          {location.building}
          {hours ? ` · ${hours.label}` : ""}
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
