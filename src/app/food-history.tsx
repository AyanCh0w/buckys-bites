import { useTheme } from "../state/ThemeProvider";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { FixedScreen, IconButton, T, Tap } from "../components/ui";
import { FoodImage, openDish } from "../components/Food";
import { useApp } from "../state/AppProvider";
import { campusDate, dateLabel, displayName } from "../lib/domain";
import { FoodNutrition } from "../components/nutrient-display";
export default function FoodHistory() {
  const { s } = useTheme();
  const { date = campusDate() } = useLocalSearchParams<{ date?: string }>();
  const { data } = useApp();
  const logs = data.logs.filter((l) => l.local_date === date);
  return (
    <FixedScreen back title={dateLabel(date)}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[s.inset, { paddingBottom: 24 }]}
      >
        {["Breakfast", "Lunch", "Dinner", "Dessert", "Snack"]
          .filter((meal) => logs.some((l) => l.meal_label === meal))
          .map((meal) => (
            <View key={meal}>
              <T style={[s.sectionTitle, { marginTop: 22 }]}>{meal}</T>
              {logs
                .filter((l) => l.meal_label === meal)
                .map((log) => (
                  <View key={log.id} style={[s.row, s.inline]}>
                    <Tap
                      padding="row"
                      style={{ flex: 1, marginLeft: -12 }}
                      onPress={() =>
                        openDish(log.food, log.local_date, log.meal_label)
                      }
                    >
                      <View style={s.inline}>
                        <FoodImage food={log.food} size={65} />
                        <View style={{ flex: 1 }}>
                          <T style={{ fontSize: 15, fontWeight: "500" }}>
                            {displayName(log.food.name)}
                          </T>
                          <T style={s.caption}>{log.servings}×</T>
                          <FoodNutrition
                            food={log.food}
                            servings={log.servings}
                          />
                        </View>
                      </View>
                    </Tap>
                    <IconButton
                      name="ellipsis-horizontal"
                      label={"Edit " + log.food.name}
                      onPress={() =>
                        router.push({
                          pathname: "/log",
                          params: { edit: log.id },
                        })
                      }
                    />
                  </View>
                ))}
            </View>
          ))}
      </ScrollView>
    </FixedScreen>
  );
}
