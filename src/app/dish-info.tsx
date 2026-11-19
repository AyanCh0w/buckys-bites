// Preserve old detail links while the nutrition content now lives inside the dish.
import { Redirect, useLocalSearchParams } from "expo-router";
export default function DishInformation() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Redirect
      href={id ? { pathname: "/dish/[id]", params: { id } } : "/menu"}
    />
  );
}
