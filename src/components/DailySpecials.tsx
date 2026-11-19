import { View } from "react-native";
import { router } from "expo-router";
import { displayName, ratingFor } from "../lib/domain";
import { stationSpecials, type SpecialMeal } from "../lib/home";
import type { Catalog } from "../lib/types";
import { useTheme } from "../state/ThemeProvider";
import { useApp } from "../state/AppProvider";
import { FoodImage, openDish } from "./Food";
import { Icon, T, Tap } from "./ui";
import { MenuEntrance } from "./MenuEntrance";

export function DailySpecials({
  catalog,
  date,
  preferredMeal,
  dietary,
}: {
  catalog: Catalog;
  date: string;
  preferredMeal: SpecialMeal;
  dietary: string[];
}) {
  const { colors, s } = useTheme();
  const { data } = useApp();
  const stations = stationSpecials(catalog, date, dietary, preferredMeal);
  const firstMessage = stations[0].periods[0].message;
  const sharedMessage = stations.every(
    (station) =>
      station.periods.length === 1 &&
      station.periods[0].message === firstMessage,
  )
    ? firstMessage
    : null;

  return (
    <View style={[s.inset, { gap: 14, marginBottom: 20 }]}>
      <View style={s.between}>
        <T
          accessibilityRole="header"
          style={[s.title, { flexShrink: 1, fontSize: 26 }]}
        >
          Today’s Specials
        </T>
        <Tap
          padding="row"
          onPress={() => router.navigate("/(tabs)/menu")}
          accessibilityLabel="View full menu"
        >
          <View style={[s.inline, { gap: 4 }]}>
            <T style={s.link}>Full menu</T>
            <Icon name="chevron-forward" size={13} color={colors.accent} />
          </View>
        </Tap>
      </View>
      {sharedMessage ? (
        <T style={s.body}>{sharedMessage}</T>
      ) : (
        stations.map(({ key, name, cafe, periods }, stationIndex) => {
          const sideBySide =
            periods.length === 2 &&
            periods.every((p) => p.options.length === 1);
          return (
            <View
              key={key}
              style={{
                borderTopWidth: 1,
                borderColor: colors.rule,
                paddingTop: 10,
                gap: 8,
              }}
            >
              <T accessibilityRole="header" style={s.sectionTitle}>
                {name}
              </T>
              <View
                style={{
                  flexDirection: sideBySide ? "row" : "column",
                  gap: sideBySide ? 16 : 12,
                }}
              >
                {periods.map(
                  ({ meal, label, options, message }, periodIndex) => (
                    <View
                      key={label}
                      style={[
                        { gap: 6 },
                        sideBySide && { flex: 1, minWidth: 0 },
                      ]}
                    >
                      <View style={[s.between, { flexWrap: "wrap", gap: 6 }]}>
                        <T
                          style={[
                            s.eyebrow,
                            { color: colors.accent, marginBottom: 0 },
                          ]}
                        >
                          {label}
                        </T>
                        {options.length > 2 && (
                          <Tap
                            accessibilityLabel={`View all ${options.length} ${name} dishes for ${label}`}
                            onPress={() =>
                              router.push({
                                pathname: "/kitchen/[key]",
                                params: { key, cafe, meal },
                              })
                            }
                          >
                            <T style={s.link}>All {options.length} dishes</T>
                          </Tap>
                        )}
                      </View>
                      {message ? (
                        <T style={s.caption}>{message}</T>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 16 }}>
                          {options.slice(0, 2).map(({ food, offeringId }) => {
                            const rating = ratingFor(
                              data.reviews,
                              food.food_item_id,
                            );
                            return (
                              <MenuEntrance
                                key={food.id}
                                sequence={
                                  stationIndex + (sideBySide ? 0 : periodIndex)
                                }
                                style={{ flex: 1, minWidth: 0 }}
                              >
                                <Tap
                                  padding="card"
                                  style={{ marginHorizontal: -6 }}
                                  accessibilityLabel={`View ${food.name}, ${name}, ${label}${rating.count ? `, average rating ${rating.average.toFixed(1)} out of 5` : ""}`}
                                  onPress={() =>
                                    openDish(food, date, meal, offeringId)
                                  }
                                >
                                  <View style={{ gap: 6 }}>
                                    <FoodImage
                                      food={food}
                                      rating={
                                        rating.count
                                          ? rating.average
                                          : undefined
                                      }
                                      style={{
                                        width: "100%",
                                        aspectRatio: 1.25,
                                        maxHeight: 165,
                                      }}
                                      fallback={
                                        <Icon
                                          name="restaurant-outline"
                                          size={36}
                                          color={colors.faint}
                                        />
                                      }
                                    />
                                    <T style={{ fontWeight: "500" }}>
                                      {displayName(food.name)}
                                    </T>
                                  </View>
                                </Tap>
                              </MenuEntrance>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  ),
                )}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
