import { router } from "expo-router";
import { View } from "react-native";
import { assets } from "../data/assets";
import { displayName } from "../lib/domain";
import type { Catalog } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { AssetImage, Icon, T, Tap } from "./ui";

export function ingredientArtwork(catalog: Catalog, componentId?: string) {
  if (!componentId) return undefined;
  const key = catalog.images
    .find((image) => image.componentId === componentId && image.path)
    ?.path?.replace(/\.png$/, "");
  return key ? assets[key] : undefined;
}

export function IngredientRow({
  componentId,
  label,
  imageSize = 100,
}: {
  componentId?: string;
  label: string;
  imageSize?: number;
}) {
  const { catalog } = useApp();
  const { colors } = useTheme();
  const name = displayName(label);
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
        minHeight: 48,
        paddingVertical: 10,
      }}
    >
      <AssetImage
        source={ingredientArtwork(catalog, componentId)}
        style={{ width: imageSize, height: imageSize }}
        fallback={null}
      />
      <T style={{ flex: 1, fontSize: 17, lineHeight: 23, fontWeight: "500" }}>
        {name}
      </T>
      {componentId && (
        <Icon name="chevron-forward" size={15} color={colors.faint} />
      )}
    </View>
  );
  return (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.rule }}>
      {componentId ? (
        <Tap
          padding="row"
          style={{ marginHorizontal: -12, marginVertical: 4 }}
          contentStyle={{ paddingVertical: 0 }}
          accessibilityLabel={name}
          onPress={() =>
            router.push({
              pathname: "/component/[id]",
              params: { id: componentId },
            })
          }
        >
          {content}
        </Tap>
      ) : (
        content
      )}
    </View>
  );
}
