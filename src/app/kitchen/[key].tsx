import { useLocalSearchParams } from "expo-router";
import { KitchenMenu } from "../../components/kitchen-menu";

export default function Kitchen() {
  const { key, ...params } = useLocalSearchParams<{
    key: string;
    cafe?: string;
    category?: string;
    meal?: string;
  }>();
  return <KitchenMenu kitchen={key} {...params} />;
}
