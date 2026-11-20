import { useRef, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayName } from "../lib/domain";
import { menuSectionLabel } from "../lib/menu";
import { fontFamily, textSizes } from "../lib/fonts";
import { money } from "../lib/menu-options";
import type { Food, Offering } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { foodArtwork, openDish } from "./Food";
import { AssetImage, Icon, T, Tap } from "./ui";
import { MenuEntrance } from "./MenuEntrance";

const sectionLabels = new Map([
  ["Pastries", "Pastries"],
  ["Hot Drinks", "Hot Drinks"],
  ["Cold Drinks", "Cold Drinks"],
  ["Breakfast Grab & Go", "Breakfast"],
  ["Fruit & Fruit Cup", "Fruit"],
]);

function menuPrice(offering?: Offering) {
  if (offering?.price != null) return money(offering.price);
  const prices = (offering?.serving_options ?? [])
    .map((size) => size.price)
    .filter((price): price is number => price != null);
  if (!prices.length) return undefined;
  const lowest = Math.min(...prices);
  return lowest === Math.max(...prices)
    ? money(lowest)
    : `From ${money(lowest)}`;
}

export function BakeryMenu({
  foods,
  placements,
  date,
  meal,
  category,
  onSelect,
}: {
  foods: Food[];
  placements: Map<string, Offering>;
  date: string;
  meal: string;
  category?: string;
  onSelect: (section: string) => void;
}) {
  const { colors, s } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { catalog } = useApp();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const reveal = useRef(category);
  const groups = new Map<string, Food[]>();
  for (const food of foods) {
    const key = placements.get(food.id)?.menu_section || "Other items";
    const items = groups.get(key);
    if (items) items.push(food);
    else groups.set(key, [food]);
  }
  const ordered = [...new Set([...sectionLabels.keys(), ...groups.keys()])];
  const fillRows =
    groups.size >= sectionLabels.size && !groups.has(category ?? "");

  return (
    <ScrollView
      ref={scroll}
      style={styles.fill}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        s.inset,
        styles.grow,
        { paddingBottom: bottom + 12 },
      ]}
    >
      {ordered
        .filter((key) => groups.has(key))
        .map((key, sectionIndex) => {
          const items = groups.get(key);
          if (!items) return null;
          const expanded = category === key;
          const label =
            sectionLabels.get(key) ?? (menuSectionLabel(key) || "Other Items");
          const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
          const cover = foodArtwork(catalog, items[0]);
          return (
            <View
              key={key}
              style={[
                styles.section,
                { borderColor: colors.rule },
                fillRows && styles.grow,
              ]}
              onLayout={({ nativeEvent: { layout } }) => {
                if (expanded && reveal.current === key) {
                  reveal.current = undefined;
                  scroll.current?.scrollTo({ y: layout.y, animated: false });
                }
              }}
            >
              <MenuEntrance
                sequence={sectionIndex}
                style={fillRows && styles.grow}
              >
                <Tap
                  padding="none"
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${count}`}
                  aria-expanded={expanded}
                  haptic={expanded ? "release" : "tap"}
                  accessibilityState={{ expanded }}
                  onPress={() => {
                    reveal.current = expanded ? undefined : key;
                    onSelect(expanded ? "" : key);
                  }}
                  style={[
                    fillRows && styles.grow,
                    { marginHorizontal: -12, marginVertical: 4 },
                  ]}
                  contentStyle={[styles.categoryRow, fillRows && styles.grow]}
                >
                  <AssetImage
                    source={cover}
                    style={styles.categoryPhoto}
                    fallback={
                      <Icon
                        name="restaurant-outline"
                        size={36}
                        color={colors.faint}
                      />
                    }
                  />
                  <View style={styles.categoryCopy}>
                    <T style={styles.categoryName}>{label}</T>
                    <T style={s.caption}>{count}</T>
                  </View>
                  <Icon
                    name={expanded ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={colors.muted}
                  />
                </Tap>
              </MenuEntrance>
              {expanded && (
                <View style={styles.grid}>
                  {items.map((food, index) => {
                    const offering = placements.get(food.id);
                    const name = displayName(food.name);
                    const price = menuPrice(offering);
                    return (
                      <MenuEntrance
                        key={food.id}
                        sequence={Math.floor(index / 3)}
                        style={styles.product}
                      >
                        <Tap
                          padding="card"
                          accessibilityRole="button"
                          accessibilityLabel={[name, price]
                            .filter(Boolean)
                            .join(", ")}
                          onPress={() =>
                            openDish(food, date, meal, offering?.id)
                          }
                        >
                          <View style={styles.photo}>
                            <AssetImage
                              source={foodArtwork(catalog, food)}
                              style={styles.art}
                              fallback={
                                <Icon
                                  name="restaurant-outline"
                                  size={28}
                                  color={colors.faint}
                                />
                              }
                            />
                          </View>
                          <Text
                            style={[styles.productName, { color: colors.ink }]}
                          >
                            {name}
                          </Text>
                          {price && (
                            <T numeric style={s.caption}>
                              {price}
                            </T>
                          )}
                        </Tap>
                      </MenuEntrance>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  section: { borderBottomWidth: StyleSheet.hairlineWidth },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 108,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  categoryPhoto: { width: 96, height: 96 },
  categoryCopy: { flex: 1, gap: 4 },
  categoryName: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
    marginHorizontal: -8,
    paddingBottom: 20,
  },
  product: { width: "33.3333%", paddingHorizontal: 4 },
  photo: {
    width: "100%",
    aspectRatio: 1.12,
    maxHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  art: { width: "110%", height: "110%" },
  productName: {
    marginTop: 6,
    fontFamily: fontFamily("600"),
    fontSize: textSizes.secondary,
    lineHeight: 19,
    letterSpacing: -0.15,
  },
});
