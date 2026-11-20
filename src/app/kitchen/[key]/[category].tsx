import { useLocalSearchParams } from "expo-router";
import { KitchenMenu } from "../../../components/kitchen-menu";

export default function KitchenCategory() {
  const { key, category, cafe, meal } = useLocalSearchParams<{
    key: string;
    category: string;
    cafe?: string;
    meal?: string;
  }>();
  return (
    <KitchenMenu kitchen={key} category={category} cafe={cafe} meal={meal} />
  );
}
