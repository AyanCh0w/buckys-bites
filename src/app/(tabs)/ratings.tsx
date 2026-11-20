import { useTheme } from "../../state/ThemeProvider";
import React, { useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  FixedScreen,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  T,
  Tap,
  tabContentBottomPadding,
} from "../../components/ui";
import { ReviewCard } from "../../components/ReviewCard";
import { ReviewSort } from "../../components/ReviewSort";
import { useApp } from "../../state/AppProvider";
import {
  hasReviewText,
  reviewFeed,
  type FeedMode,
  type TopPeriod,
} from "../../lib/discovery";

export default function Ratings() {
  const { colors, s } = useTheme();
  const { dish, reviewId } = useLocalSearchParams<{
    dish?: string;
    reviewId?: string;
  }>();
  const { data, catalog, userId, backendAvailable, resolveId } = useApp();
  const [mode, setMode] = useState<FeedMode>("For You");
  const [period, setPeriod] = useState<TopPeriod>("Day");
  if (reviewId) {
    const selected = data.reviews.find(
      (review) => review.id === resolveId(reviewId) && hasReviewText(review),
    );
    return (
      <FixedScreen tab title="Ratings">
        <ScrollView
          key={reviewId}
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            s.inset,
            { paddingBottom: tabContentBottomPadding },
          ]}
        >
          <Tap
            padding="row"
            style={{ marginLeft: -12, alignSelf: "flex-start" }}
            accessibilityLabel="View all reviews"
            onPress={() => {
              router.setParams({ reviewId: "", dish: "" });
            }}
          >
            <View style={s.inline}>
              <Icon name="chevron-back" size={15} color={colors.accent} />
              <T style={s.link}>All reviews</T>
            </View>
          </Tap>
          {selected ? (
            <ReviewCard review={selected} />
          ) : (
            <T style={s.body}>
              {backendAvailable === null
                ? "Loading review…"
                : backendAvailable
                  ? "This review is no longer available."
                  : "Couldn’t load this review."}
            </T>
          )}
        </ScrollView>
      </FixedScreen>
    );
  }
  const reviews = reviewFeed({
    reviews: data.reviews,
    mode,
    period,
    catalog,
    interests: data,
    userId,
  }).filter(
    (r) =>
      !dish ||
      catalog.foods.some(
        (f) => f.food_item_id === r.food_item_id && f.name === dish,
      ),
  );
  return (
    <FixedScreen
      tab
      title="Ratings"
      right={
        <IconButton
          name="create-outline"
          sf="square.and.pencil"
          label="Choose a dish to review"
          onPress={() => router.push("/menu")}
        />
      }
    >
      <View style={s.inset}>
        <ReviewSort
          mode={mode}
          period={period}
          onMode={setMode}
          onPeriod={setPeriod}
        />
        {Boolean(dish) && (
          <View style={{ marginTop: 14, alignSelf: "flex-start" }}>
            <Chip
              title={dish + " ×"}
              haptic="release"
              onPress={() => router.setParams({ dish: "" })}
            />
          </View>
        )}
      </View>
      <FlatList
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        data={reviews}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: tabContentBottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            art="leave-a-review"
            title="No Comments Yet"
            text={
              mode === "Top" && period !== "All time"
                ? "Try a longer timeframe."
                : "Written reviews will appear here."
            }
            action="Find a dish"
            onPress={() => router.push("/menu")}
          />
        }
      />
    </FixedScreen>
  );
}
