import { router } from "expo-router";
import { View } from "react-native";
import { campusDate, dateLabel, displayName } from "../lib/domain";
import type { Food, Review } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { FoodImage } from "./Food";
import { Avatar } from "./Avatar";
import { Art, Icon, T, Tap } from "./ui";
import { ReviewAuthor, ReviewLayout } from "./review-layout";

export function HomeReview({
  featured,
}: {
  featured?: { food: Food; review: Review };
}) {
  const { colors, s } = useTheme();
  const { backendAvailable, userId, data } = useApp();
  const panel = {
    backgroundColor: colors.accentLight,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  };
  if (!featured) {
    return (
      <View style={[panel, s.inline, { gap: 14 }]}>
        <Art name="icons/leave-a-review" size={55} />
        <View style={{ flex: 1 }}>
          <T accessibilityRole="header" style={{ fontWeight: "600" }}>
            Featured Review
          </T>
          <T style={s.caption}>
            {backendAvailable === null
              ? "Loading reviews…"
              : backendAvailable
                ? "No featured review yet."
                : "Reviews unavailable."}
          </T>
        </View>
      </View>
    );
  }
  const { food, review } = featured;
  return (
    <Tap
      padding="none"
      highlightRadius={18}
      accessibilityLabel={`Read the featured review of ${food.name}. ${review.stars} out of 5. ${review.comment?.trim()}. By ${review.display_name}, ${dateLabel(campusDate(review.created_at))}.`}
      onPress={() =>
        router.navigate({
          pathname: "/(tabs)/ratings",
          params: { reviewId: review.id },
        })
      }
    >
      <View style={panel}>
        <ReviewLayout
          photo={<FoodImage food={food} rating={review.stars} badgeSize={22} />}
          framedPhoto={false}
        >
          <View style={s.between}>
            <T style={[s.caption, { color: colors.accent }]}>Featured Review</T>
            <Icon name="arrow-forward" size={16} color={colors.accent} />
          </View>
          <T style={{ fontWeight: "600" }}>{displayName(food.name)}</T>
          <T style={s.caption}>{review.stars}/5</T>
        </ReviewLayout>
        {review.comment?.trim() && (
          <T numberOfLines={3}>“{review.comment.trim()}”</T>
        )}
        <ReviewAuthor
          avatar={
            <Avatar
              value={
                review.user_id === userId
                  ? data.profile.avatar_id
                  : review.avatar_id
              }
              size={28}
            />
          }
          name={review.display_name}
          time={dateLabel(campusDate(review.created_at))}
        />
      </View>
    </Tap>
  );
}
