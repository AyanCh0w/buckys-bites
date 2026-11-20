import { useTheme } from "../../state/ThemeProvider";
import { Tabs, router } from "expo-router";
import { View } from "react-native";
import { Image } from "expo-image";
import { Glass, T, Tap } from "../../components/ui";
import { navigationIcons } from "../../lib/navigation-icons.web";
import { ScrollEdgeFade } from "../../components/scroll-under-bar";

const icons = [
  navigationIcons.home,
  navigationIcons.menu,
  navigationIcons.nutrition,
  navigationIcons.ratings,
  navigationIcons.me,
] as const;
const titles = ["Home", "Menu", "Nutrition", "Ratings", "Me"];
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{ headerShown: false, animation: "none", lazy: false }}
      tabBar={({ state }) => (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 18,
            paddingHorizontal: 16,
          }}
        >
          {["index", "me"].includes(state.routes[state.index]?.name) && (
            <ScrollEdgeFade edge="bottom" id="tabBarFade" length={24} />
          )}
          <Glass
            style={{
              borderRadius: 36,
              padding: 6,
              boxShadow: "0 4px 28px rgba(40,50,30,0.10)",
            }}
          >
            <View style={{ flexDirection: "row" }}>
              {state.routes.map((route, i) => (
                <Tap
                  padding="none"
                  key={route.key}
                  haptic={state.index === i ? false : "select"}
                  highlightRadius={28}
                  onPress={() =>
                    router.navigate(
                      (
                        ["/", "/menu", "/nutrition", "/ratings", "/me"] as const
                      )[i],
                    )
                  }
                  style={{ flex: 1 }}
                  accessibilityLabel={titles[i]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: state.index === i }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      gap: 3,
                      minHeight: 53,
                      borderRadius: 28,
                      backgroundColor:
                        state.index === i ? colors.accentLight : "transparent",
                    }}
                  >
                    <Image
                      source={
                        state.index === i ? icons[i].selected : icons[i].default
                      }
                      style={{ width: 26, height: 26 }}
                      contentFit="contain"
                      tintColor={
                        state.index === i ? colors.accent : colors.muted
                      }
                      accessible={false}
                    />
                    <T
                      style={{
                        fontSize: 10,
                        lineHeight: 13,
                        fontWeight: "600",
                        color: state.index === i ? colors.accent : colors.muted,
                      }}
                    >
                      {titles[i]}
                    </T>
                  </View>
                </Tap>
              ))}
            </View>
          </Glass>
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="menu" />
      <Tabs.Screen name="nutrition" />
      <Tabs.Screen name="ratings" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
