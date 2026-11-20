import React, { useMemo, useState, useEffect } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FixedScreen, EmptyState } from "./ui";
import { CafeCategory, CafeMenu } from "./cafe-menu";
import { diningLocations } from "../lib/dining-locations";
import { KitchenDishes } from "./KitchenDishes";
import { ServiceTimeline } from "./ServiceTimeline";
import { useApp } from "../state/AppProvider";
import { campusDate, currentMeal } from "../lib/domain";
import { matchesDietary, rankMenuFoods } from "../lib/discovery";
import { kitchenKey, kitchenName } from "../lib/theme";
import {
  BAKERY_KEY,
  browsingCatalog,
  serviceMatchesMeal,
  stationServices,
} from "../lib/menu";
export function KitchenMenu({
  kitchen,
  cafe,
  category,
  meal: initialMeal,
}: {
  kitchen: string;
  cafe?: string;
  category?: string;
  meal?: string;
}) {
  const { bottom } = useSafeAreaInsets();
  const { catalog: fullCatalog, data, userId } = useApp();
  const catalog = useMemo(
    () => browsingCatalog(fullCatalog, data.profile.dietary),
    [fullCatalog, data.profile.dietary],
  );
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const stations = catalog.stations.filter(
    (s) => kitchenKey(s.name) === kitchen && (!cafe || s.cafe_id === cafe),
  );
  const stationIds = new Set(stations.map((s) => s.id));
  const date = campusDate(now);
  const services = stationServices(catalog, stationIds).filter(
    (service) => service.service_date === date,
  );
  const closure = catalog.services.find(
    (service) =>
      service.status === "closed" &&
      service.service_date === date &&
      stations.some((station) => station.cafe_id === service.cafe_id),
  );
  const automatic = currentMeal(now);
  const [selection, setSelection] = useState<{
    meal: string;
    period: string;
    date: string;
  } | null>(() =>
    initialMeal ? { meal: initialMeal, period: automatic, date } : null,
  );
  const available = ["Breakfast", "Lunch", "Dinner"].filter((meal) =>
    services.some((service) => serviceMatchesMeal(service, meal)),
  );
  const selected =
    selection?.date === date &&
    selection.period === automatic &&
    available.includes(selection.meal)
      ? selection.meal
      : available.includes(automatic)
        ? automatic
        : (available.at(-1) ?? automatic);
  const related = new Set(
    services
      .filter((service) => serviceMatchesMeal(service, selected))
      .map((service) => service.id),
  );
  const ids = new Set(
    catalog.offerings
      .filter(
        (o) =>
          o.is_listed &&
          related.has(o.menu_service_id) &&
          stationIds.has(o.station_id ?? ""),
      )
      .map((o) => o.food_version_id),
  );
  const foods = rankMenuFoods(
    catalog.foods.filter(
      (f) => ids.has(f.id) && matchesDietary(f, data.profile.dietary),
    ),
    catalog,
    data.reviews,
    userId,
    now,
    related,
  ).filter(
    (food, index, all) =>
      all.findIndex((entry) => entry.food_item_id === food.food_item_id) ===
      index,
  );
  const placementByFood = new Map<string, (typeof catalog.offerings)[number]>();
  for (const offering of catalog.offerings) {
    if (
      !offering.is_listed ||
      !related.has(offering.menu_service_id) ||
      !stationIds.has(offering.station_id ?? "")
    )
      continue;
    const old = placementByFood.get(offering.food_version_id);
    const activePeriod = catalog.services.find(
      (service) => service.id === offering.menu_service_id,
    )?.name;
    if (!old || activePeriod === selected)
      placementByFood.set(offering.food_version_id, offering);
  }
  const allDayOnly =
    services.length > 0 &&
    services.every((service) => service.name.startsWith("All Day"));
  const cafeMenu =
    kitchen === BAKERY_KEY ||
    diningLocations.some(
      (location) =>
        location.key !== "benson" && kitchenKey(location.name) === kitchen,
    );
  const title = kitchenName(stations[0]?.name ?? "Menu");
  const cafeItems = cafeMenu
    ? foods.map((food) => ({
        food,
        offering: placementByFood.get(food.id),
        meal: selected,
      }))
    : [];
  if (cafeMenu && category) {
    return (
      <CafeCategory
        category={category}
        cafeName={title}
        items={cafeItems}
        date={date}
      />
    );
  }
  return (
    <FixedScreen back extendToBottom title={title}>
      {services.length > 0 && !allDayOnly && (
        <ServiceTimeline
          services={services}
          selected={selected}
          onSelect={(meal) => setSelection({ meal, period: automatic, date })}
        />
      )}
      <View
        key={`${kitchen}:${cafe ?? ""}:${date}:${selected}`}
        style={{ flex: 1 }}
      >
        {foods.length > 0 ? (
          cafeMenu ? (
            <CafeMenu
              items={cafeItems}
              categoryHref={(category) => ({
                pathname: "/kitchen/[key]/[category]",
                params: { key: kitchen, category, cafe, meal: selected },
              })}
            />
          ) : (
            <KitchenDishes
              kitchen={kitchen}
              foods={foods}
              date={date}
              meal={selected}
              placements={placementByFood}
            />
          )
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: bottom + 24,
            }}
          >
            <EmptyState
              title={closure ? "Closed" : "No Dishes Listed"}
              text={
                closure?.closure_message ??
                (services.length
                  ? "Try another service or change your dietary preferences in Nutrition settings."
                  : "This kitchen hasn’t published a menu for today.")
              }
            />
          </ScrollView>
        )}
      </View>
    </FixedScreen>
  );
}
