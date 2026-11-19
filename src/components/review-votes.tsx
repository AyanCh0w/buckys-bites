import { View } from "react-native";
import { useTheme } from "../state/ThemeProvider";
import { AssetImage, T, Tap } from "./ui";

const helpfulIcon = require("../../assets/icons/review-helpful.png");
const notHelpfulIcon = require("../../assets/icons/review-not-helpful.png");
const compactCount = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

type ReviewVotesProps = {
  upvotes: number;
  downvotes: number;
  selectedVote?: number;
  onVote: (direction: 1 | -1) => void;
  disabled?: boolean;
  subject?: string;
};

export function ReviewVotes({
  upvotes,
  downvotes,
  selectedVote,
  onVote,
  disabled = false,
  subject = "this review",
}: ReviewVotesProps) {
  const { colors } = useTheme();
  const reviewSubject = subject.trim() || "this review";

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
      {([1, -1] as const).map((direction) => {
        const helpful = direction === 1;
        const count = helpful ? upvotes : downvotes;
        const label = helpful ? "Helpful" : "Not helpful";
        const selected = selectedVote === direction;

        return (
          <Tap
            padding="none"
            key={direction}
            onPress={() => onVote(direction)}
            disabled={disabled}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${label} for ${reviewSubject}, ${count.toLocaleString()} ${label.toLowerCase()} ${count === 1 ? "vote" : "votes"}`}
            accessibilityHint={
              selected
                ? "Removes your vote."
                : `Marks ${reviewSubject} as ${label.toLowerCase()}.`
            }
            accessibilityState={{ selected, disabled }}
            feedback="scale"
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
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
            >
              <AssetImage
                source={helpful ? helpfulIcon : notHelpfulIcon}
                style={{ width: 28, height: 28 }}
              />
            </View>
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
      })}
    </View>
  );
}
