import { useTheme } from "../state/ThemeProvider";
import { backOrReplace } from "../lib/navigation";
import React, { useState } from "react";
import { Keyboard, Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../state/AppProvider";
import { Art, BackHeader, Button, Icon, Input, T, Tap } from "../components/ui";
import { FoodImage } from "../components/Food";
import { displayName, reviewEligibility } from "../lib/domain";
import type { Food, Review } from "../lib/types";

export default function WriteReview() {
  const { s } = useTheme();
  const { food: foodId, edit } = useLocalSearchParams<{
    food?: string;
    edit?: string;
  }>();
  const { catalog, data, userId } = useApp();
  const previous = edit
    ? data.reviews.find((r) => r.id === edit && r.user_id === userId)
    : undefined;
  const matchesFood = (f: Food) =>
    foodId ? f.id === foodId : f.food_item_id === previous?.food_item_id;
  const food =
    catalog.foods.find(matchesFood) ??
    data.logs.find((log) => matchesFood(log.food))?.food;
  if (
    !food ||
    (edit && (!previous || previous.food_item_id !== food.food_item_id))
  )
    return (
      <>
        {Platform.OS !== "ios" && <BackHeader />}
        <T style={s.inset}>
          {edit ? "This review is unavailable." : "Choose a dish to review."}
        </T>
      </>
    );
  return (
    <ReviewForm key={previous?.id ?? food.id} food={food} previous={previous} />
  );
}

function ReviewForm({ food, previous }: { food: Food; previous?: Review }) {
  const { colors, s } = useTheme();
  const { data, userId, saveReview, notify } = useApp();
  const edit = previous?.id;
  const [stars, setStars] = useState(previous?.stars ?? 0);
  const [comment, setComment] = useState(previous?.comment ?? "");
  const [editingComment, setEditingComment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligibility = reviewEligibility(
    data.history,
    data.reviews,
    userId ?? "",
    food.food_item_id,
    new Date(),
    edit,
    data.submissions,
  );
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      style={{ backgroundColor: colors.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {Platform.OS !== "ios" && (
        <BackHeader title={edit ? "Edit Review" : "Review Dish"} />
      )}
      <View style={[s.inset, { paddingTop: 15, gap: 22 }]}>
        <View style={{ alignItems: "center" }}>
          <FoodImage food={food} size={104} hideIfUnavailable />
          <T
            style={{
              fontSize: 24,
              lineHeight: 30,
              letterSpacing: -0.7,
              fontWeight: "600",
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {displayName(food.name)}
          </T>
        </View>
        <View style={{ gap: 4 }}>
          <T style={[s.body, { textAlign: "center" }]}>{eligibility.reason}</T>
          {edit && (
            <T style={[s.caption, { textAlign: "center" }]}>
              You can post a new review of this dish one week after your last
              review.
            </T>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((score) => (
            <Tap
              key={score}
              contentStyle={{
                backgroundColor: score === stars ? colors.pressed : undefined,
                borderRadius: 16,
              }}
              onPress={() => setStars(score)}
              style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
              accessibilityLabel={`${score} ${score === 1 ? "star" : "stars"}, ${["", "Angry", "Upset", "Neutral", "Happy", "Ecstatic"][score]}`}
              accessibilityState={{ selected: score === stars }}
            >
              <View
                style={{
                  alignItems: "center",
                }}
              >
                <Art
                  name={`ratings/bucky-${score}-star`}
                  size={47}
                  style={{ width: "100%", maxWidth: 47 }}
                />
                <T
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: score === stars ? colors.accent : colors.muted,
                    marginTop: 4,
                  }}
                >
                  {score}
                </T>
              </View>
            </Tap>
          ))}
        </View>
        <T
          style={{
            textAlign: "center",
            color: colors.accent,
            fontWeight: "600",
          }}
        >
          {
            [
              "Pick your Bucky",
              "Not for me",
              "Could be better",
              "It was okay",
              "A good bite",
              "A new favorite",
            ][stars]
          }
        </T>
        <View style={{ gap: 4 }}>
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <T style={{ flex: 1, fontWeight: "600" }}>
              Tell the Table <T style={s.caption}>(optional)</T>
            </T>
            {editingComment && (
              <Tap
                padding="none"
                onPress={Keyboard.dismiss}
                accessibilityLabel="Hide keyboard"
                onPointerDown={
                  Platform.OS === "web"
                    ? (event) => event.preventDefault()
                    : undefined
                }
              >
                <View
                  style={[s.inline, { minHeight: 44, paddingHorizontal: 8 }]}
                >
                  <Icon name="keypad-outline" color={colors.accent} size={16} />
                  <T style={{ color: colors.accent, fontWeight: "600" }}>
                    Done
                  </T>
                </View>
              </Tap>
            )}
          </View>
          <Input
            multiline
            value={comment}
            onChangeText={setComment}
            onFocus={() => setEditingComment(true)}
            onBlur={() => setEditingComment(false)}
            maxLength={2000}
            placeholder="What stood out about this dish?"
            accessibilityLabel="Review text"
            style={{
              height: 104,
              textAlignVertical: "top",
              borderWidth: 1,
              borderColor: editingComment ? colors.accent : colors.rule,
            }}
          />
          <T style={[s.caption, { textAlign: "right" }]}>
            {comment.length}/2,000
          </T>
        </View>
        <View style={s.note}>
          <T style={s.caption}>
            Your name, avatar, karma, day eaten, meal, and review are public.
            Your meal logs are visible to you and the app developer, not other
            students.
          </T>
          <T style={[s.caption, { marginTop: 8 }]}>
            {!edit && "One new review per dish every seven days. "}
            Only your latest score counts toward the dish’s rating.
          </T>
        </View>
        {Boolean(error) && (
          <T style={{ color: colors.red }} accessibilityRole="alert">
            {error}
          </T>
        )}
        <Button
          title={
            busy
              ? "Saving…"
              : edit
                ? "Save changes"
                : comment.trim()
                  ? "Publish review"
                  : "Save rating"
          }
          disabled={!stars || !eligibility.eligible || busy}
          onPress={async () => {
            Keyboard.dismiss();
            setBusy(true);
            setError("");
            try {
              await saveReview(food, stars, comment, edit);
              backOrReplace("/ratings");
              notify(
                edit
                  ? "Changes saved"
                  : comment.trim()
                    ? "Review published"
                    : "Rating saved",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {!eligibility.eligible && (
          <Button
            secondary
            title="View dish"
            onPress={() => backOrReplace("/ratings")}
          />
        )}
      </View>
    </ScrollView>
  );
}
