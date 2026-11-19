import { useTheme } from "../state/ThemeProvider";
import { View } from "react-native";
import { useApp } from "../state/AppProvider";
import { AssetImage, T, Tap } from "./ui";
import { FoodImage, openDish } from "./Food";
import { hasReviewText } from "../lib/discovery";
import type { Review } from "../lib/types";
import { campusDate, dateLabel, displayName } from "../lib/domain";

import { Avatar } from "./Avatar";
import { RatingScore } from "./rating-score";
import { ReviewAuthor, ReviewLayout } from "./review-layout";
import { ReviewVotes } from "./review-votes";

function ReviewFoodHeader({
  review,
  onEdit,
}: {
  review: Review;
  onEdit?: () => void;
}) {
  const { s } = useTheme();
  const { catalog } = useApp();
  const food = catalog.foods.find(
    (f) => f.food_item_id === review.food_item_id,
  );
  return (
    <ReviewLayout
      photo={
        food ? (
          <Tap
            padding="none"
            onPress={() => openDish(food)}
            accessibilityLabel={`View ${displayName(food.name)}`}
            contentStyle={{ minHeight: 88, justifyContent: "center" }}
          >
            <FoodImage food={food} />
          </Tap>
        ) : (
          <AssetImage style={{ width: "100%", aspectRatio: 1 }} />
        )
      }
    >
      {food && (
        <Tap
          padding="none"
          onPress={() => openDish(food)}
          contentStyle={{ minHeight: 44, justifyContent: "center" }}
        >
          <T style={{ fontWeight: "600" }}>{displayName(food.name)}</T>
        </Tap>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <RatingScore value={review.stars} size={30} />
        {onEdit && (
          <Tap
            onPress={onEdit}
            accessibilityLabel={
              food
                ? `Edit your review of ${displayName(food.name)}`
                : "Edit your review"
            }
          >
            <T style={s.link}>Edit</T>
          </Tap>
        )}
      </View>
    </ReviewLayout>
  );
}

export function ReviewCard({
  review,
  showFood = true,
  onEdit,
}: {
  review: Review;
  showFood?: boolean;
  onEdit?: () => void;
}) {
  const { colors } = useTheme();
  const { data, userId, vote, notify } = useApp();
  const written = hasReviewText(review);
  return (
    <View
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: colors.rule,
      }}
    >
      {showFood ? (
        <>
          <ReviewFoodHeader review={review} onEdit={onEdit} />
          {written && <T style={{ marginTop: 10 }}>{review.comment}</T>}
        </>
      ) : (
        <View
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
        >
          <RatingScore value={review.stars} size={30} />
          {written && (
            <T style={{ flex: 1, alignSelf: "center" }}>{review.comment}</T>
          )}
        </View>
      )}
      <View style={{ marginTop: 10 }}>
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
          name={`${review.display_name}${review.user_id === userId ? " · You" : ""}`}
          time={dateLabel(campusDate(review.created_at))}
          trailing={
            written ? (
              <ReviewVotes
                upvotes={review.upvotes}
                downvotes={review.downvotes}
                selectedVote={data.votes[review.id]}
                subject={`${review.display_name}’s review`}
                onVote={(direction) =>
                  vote(review, direction).catch((e) => notify(e.message))
                }
              />
            ) : undefined
          }
        />
      </View>
    </View>
  );
}
