import { View } from "react-native";
import { Segments } from "./ui";
import { serviceMatchesMeal } from "../lib/menu";
import type { Service } from "../lib/types";

export const mealPeriods = ["Breakfast", "Lunch", "Dinner"];
export function ServiceTimeline({
  services,
  selected,
  onSelect,
}: {
  services: Service[];
  selected: string;
  onSelect: (meal: string) => void;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 16 }}>
      <Segments
        values={mealPeriods}
        value={selected}
        onChange={onSelect}
        disabledValues={mealPeriods.filter(
          (m) => !services.some((service) => serviceMatchesMeal(service, m)),
        )}
      />
    </View>
  );
}
