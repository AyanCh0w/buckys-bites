import { useTheme } from "../../state/ThemeProvider";
import React from "react";
import { FlatList, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "../../state/AppProvider";
import { Art, Button, IconButton, T, Tap } from "../../components/ui";
import { Avatar } from "../../components/Avatar";
import { ReviewCard } from "../../components/ReviewCard";

export default function Me() {
  const { colors, s } = useTheme();
  const { data, userId, local } = useApp();
  const insets = useSafeAreaInsets();
  const mine = data.reviews
    .filter((r) => r.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const karma = mine.reduce((n, r) => n + r.score, 0);
  const settings = (section: string) =>
    router.push({ pathname: "/settings", params: { section } });
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
      }}
    >
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={mine}
        keyExtractor={(review) => review.id}
        renderItem={({ item }) => (
          <ReviewCard
            review={item}
            onEdit={() =>
              router.push({ pathname: "/review", params: { edit: item.id } })
            }
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop:
            Platform.OS === "web"
              ? 26
              : Platform.OS === "ios"
                ? 8
                : insets.top + 8,
          paddingBottom: Platform.OS === "web" ? 112 : 24,
        }}
        ListHeaderComponent={
          <>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Tap
                padding="row"
                style={{ flex: 1, marginLeft: -12 }}
                accessibilityLabel="Edit your profile"
                onPress={() => settings("profile")}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 20,
                    alignItems: "center",
                    paddingVertical: 4,
                  }}
                >
                  <Avatar value={data.profile.avatar_id} size={84} />
                  <View style={{ flex: 1, gap: 7 }}>
                    <T
                      accessibilityRole="header"
                      style={{
                        fontSize: 30,
                        lineHeight: 36,
                        fontWeight: "700",
                        letterSpacing: -0.8,
                      }}
                    >
                      {data.profile.display_name}
                    </T>
                    <T style={s.caption}>
                      {mine.length} reviews · {karma} karma
                    </T>
                  </View>
                </View>
              </Tap>
              <IconButton
                name="create-outline"
                sf="pencil"
                label="Customize profile and picture"
                onPress={() => settings("profile")}
              />
              <IconButton
                name="settings-outline"
                sf="gearshape"
                label="Settings"
                onPress={() => settings("general")}
              />
            </View>
            {local && (
              <View style={{ marginBottom: 16 }}>
                <Button title="Sign in" onPress={() => router.push("/auth")} />
              </View>
            )}
            <T
              accessibilityRole="header"
              style={{
                fontSize: 22,
                fontWeight: "600",
                marginTop: 24,
                marginBottom: 4,
              }}
            >
              Your Reviews
            </T>
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 16 }}>
            <Art name="icons/leave-a-review" size={112} />
            <T style={s.caption}>Your reviews will appear here.</T>
            <Tap onPress={() => router.push("/menu")}>
              <T style={s.link}>Review a dish</T>
            </Tap>
          </View>
        }
        ListFooterComponent={
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 28,
              marginTop: 30,
            }}
          >
            {(["about", "privacy"] as const).map((section) => (
              <Tap key={section} onPress={() => settings(section)}>
                <T
                  style={{
                    fontSize: 12,
                    color: colors.muted,
                  }}
                >
                  {section === "about" ? "About" : "Privacy"}
                </T>
              </Tap>
            ))}
          </View>
        }
      />
    </View>
  );
}
