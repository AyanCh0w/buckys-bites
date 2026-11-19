import { useTheme } from "../../state/ThemeProvider";
import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AssetImage, FixedScreen, T } from "../../components/ui";
import { ingredientArtwork } from "../../components/ingredient-row";
import {
  NutritionSummary,
  NutritionDetails,
} from "../../components/NutritionSummary";
import { useApp } from "../../state/AppProvider";
import { displayName } from "../../lib/domain";
import { ingredientNutrition } from "../../lib/menu";
import { roundedNutritionFacts } from "../../lib/nutrition-display";

export default function IngredientDetail() {
  const { s } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { catalog } = useApp();
  const ingredient = catalog.components.find((c) => c.id === id);
  const published = ingredient ? ingredientNutrition(ingredient) : null;
  const estimate = ingredient?.estimated_nutrition;
  const facts =
    published ?? (estimate && roundedNutritionFacts(estimate.nutrients));
  const serving = published?.servingSize;
  return (
    <FixedScreen back title="">
      <ScrollView
        key={id}
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <AssetImage
          source={ingredientArtwork(catalog, id)}
          style={{ width: 260, height: 260, alignSelf: "center" }}
          fallback={null}
        />
        <T
          style={[
            s.title,
            { fontSize: 29, lineHeight: 35, marginTop: 15, marginBottom: 28 },
          ]}
        >
          {ingredient ? displayName(ingredient.name) : "Not available"}
        </T>
        <NutritionSummary
          published={facts}
          serving={
            serving ? serving.value + " " + serving.unit : estimate?.serving
          }
        />
        {facts && (
          <NutritionDetails
            published={facts}
            showMissing={!published && Boolean(estimate)}
          />
        )}
      </ScrollView>
    </FixedScreen>
  );
}
