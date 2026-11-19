import { useTheme } from "../../state/ThemeProvider";
import React, { useMemo, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../../state/AppProvider";
import {
  Art,
  EmptyState,
  FixedScreen,
  Icon,
  T,
  Tap,
  tabContentBottomPadding,
} from "../../components/ui";
import { FoodImage } from "../../components/Food";
import { BakeryMenuArt } from "../../components/bakery-menu-art";
import { MealHighlights } from "../../components/KitchenDishes";
import { MenuEntrance } from "../../components/MenuEntrance";
import { currentMealPicks } from "../../lib/home";
import { campusDate, dateLabel, timeLabel } from "../../lib/domain";
import {
  BAKERY_KEY,
  DEFAULT_STARRED_KITCHENS,
  browsingCatalog,
  kitchenMenus,
} from "../../lib/menu";

export default function Menu() {
  const { colors, s } = useTheme();
  const {
    catalog: fullCatalog,
    data,
    userId,
    refreshing,
    refresh,
    syncError,
    profileStatus,
    saveProfile,
  } = useApp();
  const catalog = useMemo(
    () => browsingCatalog(fullCatalog, data.profile.dietary),
    [fullCatalog, data.profile.dietary],
  );
  const [now, setNow] = useState(new Date());
  const starred = data.profile.starred_kitchens ?? DEFAULT_STARRED_KITCHENS;
  const [savingStar, setSavingStar] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const toggleStar = async (key: string) => {
    const next = starred.includes(key)
      ? starred.filter((value) => value !== key)
      : [...starred, key];
    setSavingStar(true);
    setStarError(null);
    try {
      await saveProfile({ ...data.profile, starred_kitchens: next });
    } catch {
      setStarError("Couldn’t save your starred kitchens. Try again.");
    } finally {
      setSavingStar(false);
    }
  };
  const kitchens = kitchenMenus(
    catalog,
    now,
    data.reviews,
    userId,
    data.profile.dietary,
    starred,
  );
  const sync = catalog.services
    .map((s) => s.last_successful_sync_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const highlights = currentMealPicks(
    catalog,
    data.reviews,
    userId,
    data.profile.dietary,
    now,
  );
  const highlightPosition = kitchens.findIndex(
    (kitchen) => !starred.includes(kitchen.key),
  );
  const mealHighlights = highlights.meal && highlights.dishes.length > 0 && (
    <MealHighlights
      foods={highlights.dishes}
      date={campusDate(now)}
      meal={highlights.meal}
      sequence={highlightPosition < 0 ? kitchens.length : highlightPosition}
    />
  );
  return (
    <FixedScreen title="Menu" tab>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: tabContentBottomPadding,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        {starError && (
          <T
            accessibilityRole="alert"
            style={[s.caption, { color: colors.red }]}
          >
            {starError}
          </T>
        )}
        {!kitchens.length && (
          <EmptyState
            title="No Matching Meals"
            text="You can change your dietary preferences in Nutrition settings."
          />
        )}
        {kitchens.map((kitchen, index) => {
          const isStarred = starred.includes(kitchen.key);
          return (
            <React.Fragment key={kitchen.key}>
              {index === highlightPosition && mealHighlights}
              <MenuEntrance
                sequence={
                  index +
                  (mealHighlights &&
                  index >= highlightPosition &&
                  highlightPosition >= 0
                    ? 1
                    : 0)
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 0.5,
                  borderColor: colors.rule,
                }}
              >
                <Tap
                  padding="none"
                  style={{ flex: 1, marginLeft: -12, marginVertical: 4 }}
                  contentStyle={{ paddingHorizontal: 12, paddingVertical: 4 }}
                  onPress={() =>
                    router.push({
                      pathname: "/kitchen/[key]",
                      params: {
                        key: kitchen.key,
                        cafe: kitchen.cafe,
                      },
                    })
                  }
                  accessibilityLabel={`${kitchen.name}, ${kitchen.hours.label}. Open menu`}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      minHeight: 108,
                    }}
                  >
                    <View style={{ opacity: kitchen.open ? 1 : 0.35 }}>
                      {kitchen.key === BAKERY_KEY ? (
                        <BakeryMenuArt date={kitchen.date} />
                      ) : kitchen.key === "fire" ? (
                        <Art name="dishes/signature-smash-burger" size={96} />
                      ) : kitchen.featured ? (
                        <FoodImage food={kitchen.featured} size={96} />
                      ) : (
                        <Art size={96} />
                      )}
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T
                        style={{
                          fontSize: 19,
                          fontWeight: "600",
                          letterSpacing: -0.4,
                          color: kitchen.open ? colors.ink : colors.muted,
                        }}
                      >
                        {kitchen.name}
                      </T>
                      <T style={[s.caption, { fontSize: 12, lineHeight: 17 }]}>
                        {kitchen.hours.label}
                      </T>
                    </View>
                    <Icon
                      name="chevron-forward"
                      size={16}
                      color={kitchen.open ? colors.muted : colors.faint}
                    />
                  </View>
                </Tap>
                <Tap
                  padding="none"
                  feedback="scale"
                  highlightRadius={22}
                  accessibilityLabel={`${isStarred ? "Unstar" : "Star"} ${kitchen.name}`}
                  accessibilityState={{ selected: isStarred }}
                  disabled={profileStatus !== "saved" || savingStar}
                  onPress={() => void toggleStar(kitchen.key)}
                >
                  <View style={s.iconButton}>
                    <Icon
                      name={isStarred ? "star" : "star-outline"}
                      sf={isStarred ? "star.fill" : "star"}
                      color={isStarred ? colors.accent : colors.muted}
                      size={21}
                    />
                  </View>
                </Tap>
              </MenuEntrance>
            </React.Fragment>
          );
        })}
        {highlightPosition === -1 && mealHighlights}
        <T
          style={[
            s.caption,
            { fontSize: 11, marginTop: 22, textAlign: "center" },
          ]}
        >
          {syncError ??
            (sync
              ? "Updated " +
                dateLabel(campusDate(sync)) +
                ", " +
                timeLabel(sync)
              : "Menu saved on this device")}
        </T>
      </ScrollView>
    </FixedScreen>
  );
}
