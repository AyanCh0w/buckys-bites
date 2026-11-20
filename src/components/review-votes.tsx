import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../state/ThemeProvider";
import { AssetImage, T, Tap } from "./ui";

const helpfulIcon = require("../../assets/icons/review-helpful.png");
const notHelpfulIcon = require("../../assets/icons/review-not-helpful.png");
const compactCount = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const bounceOut = Easing.bezier(0.23, 1, 0.32, 1);

type ReviewVotesProps = {
  upvotes: number;
  downvotes: number;
  selectedVote?: number;
  onVote: (direction: 1 | -1) => void;
  disabled?: boolean;
  subject?: string;
};

function VoteButton({
  direction,
  count,
  selected,
  disabled,
  subject,
  onVote,
}: {
  direction: 1 | -1;
  count: number;
  selected: boolean;
  disabled: boolean;
  subject: string;
  onVote: ReviewVotesProps["onVote"];
}) {
  const { colors } = useTheme();
  const helpful = direction === 1;
  const label = helpful ? "Helpful" : "Not helpful";
  const offset = useSharedValue(0);
  const reduced = useReducedMotion();
  const handStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));
  const press = () => {
    if (!reduced) {
      offset.set(
        withSequence(
          withTiming(-6 * direction, { duration: 80, easing: bounceOut }),
          withSpring(0, { duration: 200, dampingRatio: 0.8 }),
        ),
      );
    }
    onVote(direction);
  };
  return (
    <Tap
      padding="none"
      onPress={press}
      haptic={false}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${label} for ${subject}, ${count.toLocaleString()} ${label.toLowerCase()} ${count === 1 ? "vote" : "votes"}`}
      accessibilityHint={
        selected
          ? "Removes your vote."
          : `Marks ${subject} as ${label.toLowerCase()}.`
      }
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      highlightRadius={10}
      contentStyle={{
        minWidth: 44,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 10,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: selected ? colors.accent : "transparent",
        backgroundColor: selected ? colors.accentLight : "transparent",
      }}
    >
      <Animated.View
        style={handStyle}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <AssetImage
          source={helpful ? helpfulIcon : notHelpfulIcon}
          style={{ width: 28, height: 28 }}
        />
      </Animated.View>
      <T
        accessible={false}
        numeric
        style={{
          fontSize: 14,
          fontVariant: ["tabular-nums"],
          color: selected ? colors.accent : colors.muted,
        }}
      >
        {compactCount.format(count)}
      </T>
    </Tap>
  );
}

export function ReviewVotes({
  upvotes,
  downvotes,
  selectedVote,
  onVote,
  disabled = false,
  subject = "this review",
}: ReviewVotesProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        flexShrink: 0,
        gap: 4,
      }}
    >
      {([1, -1] as const).map((direction) => (
        <VoteButton
          key={direction}
          direction={direction}
          count={direction === 1 ? upvotes : downvotes}
          selected={selectedVote === direction}
          disabled={disabled}
          subject={subject.trim() || "this review"}
          onVote={onVote}
        />
      ))}
    </View>
  );
}
