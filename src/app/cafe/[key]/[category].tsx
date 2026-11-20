import { Redirect, useLocalSearchParams } from "expo-router";
import { CampusMenu } from "../../../components/campus-menu";
import { diningLocations } from "../../../lib/dining-locations";

export default function CampusCafeCategory() {
  const { key, category } = useLocalSearchParams<{
    key: string;
    category: string;
  }>();
  const location = diningLocations.find(
    (location) => location.key !== "benson" && location.key === key,
  );
  if (!location) return <Redirect href="/menu" />;
  return <CampusMenu location={location} category={category} />;
}
