import { useRef, type ComponentRef, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { displayName } from "../lib/domain";
import { cafeMenuCategory } from "../lib/dining-locations";
import { menuSectionLabel } from "../lib/menu";
import { fontFamily, textSizes } from "../lib/fonts";
import { money } from "../lib/menu-options";
import type { Food, Offering } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { foodArtwork, openDish } from "./Food";
import { AssetImage, Icon, T, Tap, tabContentBottomPadding } from "./ui";
import { MenuEntrance } from "./MenuEntrance";
import { BakeryThumbnail, useBakeryThumbnails } from "./bakery-thumbnail";

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

type MenuItem = { food: Food; offering?: Offering; meal?: string };

export function CafeMenu({
  items,
  date,
  category,
  onSelect,
  children,
  refreshControl,
  tab = false,
}: {
  items: MenuItem[];
  date: string;
  category?: string;
  onSelect: (section: string) => void;
  children?: ReactNode;
  refreshControl?: ScrollViewProps["refreshControl"];
  tab?: boolean;
}) {
  const { colors, s } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { catalog } = useApp();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const reveal = useRef(category);
  const { picks } = useBakeryThumbnails();
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    const key = cafeMenuCategory(item.food, item.offering);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const ordered = [...new Set([...sectionLabels.keys(), ...groups.keys()])];
  const fillRows =
    groups.size >= sectionLabels.size && !groups.has(category ?? "");

  return (
    <ScrollView
      ref={scroll}
      refreshControl={refreshControl}
      style={styles.fill}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        s.inset,
        styles.grow,
        { paddingBottom: tab ? tabContentBottomPadding : bottom + 12 },
      ]}
    >
      {children}
      {ordered
        .filter((key) => groups.has(key))
        .map((key, sectionIndex) => {
          const items = groups.get(key);
          if (!items) return null;
          const expanded = category === key;
          const label =
            sectionLabels.get(key) ?? (menuSectionLabel(key) || "Other Items");
          const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
          const cover = picks.categories(
            items.map(({ food }) => foodArtwork(catalog, food)),
          );
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
                  <BakeryThumbnail
                    source={cover}
                    size={96}
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
                  {items.map(({ food, offering, meal }, index) => {
                    const name = displayName(food.name);
                    const price = menuPrice(offering);
                    return (
                      <MenuEntrance
                        key={offering?.id ?? food.id}
                        sequence={Math.floor(index / 3)}
                        style={[
                          styles.product,
                          items.length === 2 && styles.pair,
                        ]}
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
  pair: { width: "50%" },
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
