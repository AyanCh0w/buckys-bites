import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { BAKERY_KEY } from "../lib/menu";
import { kitchenKey } from "../lib/theme";
import { useApp } from "../state/AppProvider";
import { foodArtwork } from "./Food";
import { Art, AssetImage } from "./ui";

export function BakeryMenuArt({ date }: { date: string }) {
  const { catalog } = useApp();
  const [roll, setRoll] = useState([0, 0]);
  useFocusEffect(
    useCallback(() => {
      setRoll([Math.random(), Math.random()]);
    }, []),
  );

  const pools = useMemo(() => {
    const stations = new Set(
      catalog.stations
        .filter((station) => kitchenKey(station.name) === BAKERY_KEY)
        .map((station) => station.id),
    );
    const services = new Set(
      catalog.services
        .filter(
          (service) =>
            service.status === "published" && service.service_date === date,
        )
        .map((service) => service.id),
    );
    const foods = new Map(catalog.foods.map((food) => [food.id, food]));
    const drinks = new Set<number>();
    const pastries = new Set<number>();
    const todayDrinks = new Set<number>();
    const todayPastries = new Set<number>();
    for (const offering of catalog.offerings) {
      if (!offering.is_listed || !stations.has(offering.station_id ?? ""))
        continue;
      const pastry = offering.menu_section === "Pastries";
      if (
        !pastry &&
        offering.menu_section !== "Hot Drinks" &&
        offering.menu_section !== "Cold Drinks"
      )
        continue;

      const food = foods.get(offering.food_version_id);
      const artwork = food && foodArtwork(catalog, food);
      if (artwork == null) continue;
      (pastry ? pastries : drinks).add(artwork);
      if (services.has(offering.menu_service_id))
        (pastry ? todayPastries : todayDrinks).add(artwork);
    }
    return [
      [...(todayDrinks.size ? todayDrinks : drinks)],
      [...(todayPastries.size ? todayPastries : pastries)],
    ];
  }, [catalog, date]);

  const [drink, pastry] = pools.map(
    (pool, index) => pool[Math.floor(roll[index] * pool.length)],
  );
  if (drink == null && pastry == null)
    return <Art name="cafes/mission-bakery" size={96} />;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 96,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AssetImage
        source={drink}
        style={
          pastry == null
            ? { width: 76, height: 76 }
            : { position: "absolute", left: 0, top: 9, width: 61, height: 70 }
        }
        fallback={null}
      />
      <AssetImage
        source={pastry}
        style={
          drink == null
            ? { width: 76, height: 76 }
            : {
                position: "absolute",
                right: 0,
                bottom: 8,
                width: 63,
                height: 54,
              }
        }
        fallback={null}
      />
    </View>
  );
}
