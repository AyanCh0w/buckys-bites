import { View, useWindowDimensions } from "react-native";
import type { Offering } from "../lib/types";
import { campusDate, displayName } from "../lib/domain";
import { groupLimit, money, toggleChoice } from "../lib/menu-options";
import { useApp } from "../state/AppProvider";
import { useTheme } from "../state/ThemeProvider";
import { ingredientArtwork, useOpenIngredient } from "./ingredient-row";
import { AssetImage, Icon, T, Tap } from "./ui";

type Selection = {
  size?: string;
  choices: string[];
  onSize: (size: string) => void;
  onChoices: (choices: string[]) => void;
};

export function MenuOptions({
  offering,
  selection,
  showDetails = false,
  serviceDate,
}: {
  offering: Offering;
  selection: Selection;
  showDetails?: boolean;
  serviceDate?: string;
}) {
  const { catalog } = useApp();
  const openIngredient = useOpenIngredient();
  const { s } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 360 || fontScale > 1.3 ? "100%" : "48%";
  const sizes = offering.serving_options ?? [];
  const groups = offering.modifier_groups ?? [];

  return (
    <View style={{ gap: 22 }}>
      {showDetails && offering.price != null && (
        <T style={s.body}>{money(offering.price)}</T>
      )}
      {sizes.length > 0 && (
        <View style={{ gap: 8 }}>
          <T accessibilityRole="header" style={{ fontWeight: "600" }}>
            Size
          </T>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
          >
            {sizes.map((size) => (
              <OptionTile
                key={size.label}
                width={columns}
                name={displayName(size.label)}
                price={size.price == null ? undefined : money(size.price)}
                detail={
                  showDetails && size.published_serving
                    ? "Published nutrition serving"
                    : undefined
                }
                single
                checked={selection.size === size.label}
                onPress={() => selection.onSize(size.label)}
              />
            ))}
          </View>
        </View>
      )}
      {groups.map((group) => {
        const single = group.max === 1;
        const selectedCount = group.options.filter((option) =>
          selection.choices.includes(option.key),
        ).length;
        const limit = groupLimit(group);
        return (
          <View key={group.name} style={{ gap: 8 }}>
            <T accessibilityRole="header" style={{ fontWeight: "600" }}>
              {group.name}
            </T>
            {limit && <T style={s.caption}>{limit}</T>}
            <View
              accessibilityRole={single ? "radiogroup" : undefined}
              accessibilityLabel={single ? group.name : undefined}
              style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
            >
              {group.options.map((option) => {
                const componentId = option.component_id;
                const checked = selection.choices.includes(option.key);
                const unavailable =
                  serviceDate && option.observed_unavailable_on === serviceDate;
                return (
                  <OptionTile
                    key={option.key}
                    width={columns}
                    name={displayName(option.label)}
                    price={
                      option.price != null && option.price > 0
                        ? `+${money(option.price)}`
                        : undefined
                    }
                    artwork={ingredientArtwork(catalog, option.component_id)}
                    detail={
                      unavailable
                        ? serviceDate === campusDate()
                          ? "Unavailable when checked today"
                          : "Unavailable when this menu was checked"
                        : undefined
                    }
                    onShowDetails={
                      showDetails && componentId
                        ? () => openIngredient(componentId)
                        : undefined
                    }
                    single={single}
                    checked={checked}
                    disabled={
                      !single &&
                      !checked &&
                      group.max != null &&
                      selectedCount >= group.max
                    }
                    onPress={() =>
                      selection.onChoices(
                        toggleChoice(selection.choices, group, option),
                      )
                    }
                  />
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function OptionTile({
  width,
  name,
  price,
  artwork,
  detail,
  onShowDetails,
  single,
  checked,
  disabled,
  onPress,
}: {
  width: "100%" | "48%";
  name: string;
  price?: string;
  artwork?: ReturnType<typeof ingredientArtwork>;
  detail?: string;
  onShowDetails?: () => void;
  single: boolean;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors, s } = useTheme();
  return (
    <View
      style={{
        width,
        borderWidth: 1,
        borderColor: checked ? colors.accent : colors.rule,
        backgroundColor: checked ? colors.accentLight : colors.paper,
        borderRadius: 14,
        borderCurve: "continuous",
        overflow: "hidden",
      }}
    >
      <Tap
        padding="none"
        highlightRadius={14}
        style={{ flex: 1 }}
        accessibilityRole={single ? "radio" : "checkbox"}
        haptic={
          single
            ? checked ? false : "select"
            : checked ? "release" : "attach"
        }
        accessibilityLabel={[name, price, detail].filter(Boolean).join(", ")}
        aria-checked={checked}
        disabled={disabled}
        onPress={onPress}
      >
        <View style={{ minHeight: 44, padding: 10, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: single ? 9 : 4,
                borderColor: checked ? colors.accent : colors.muted,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {checked &&
                (single ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.accent,
                    }}
                  />
                ) : (
                  <Icon name="checkmark" size={13} color={colors.accent} />
                ))}
            </View>
            {!artwork && (
              <T
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: "600",
                  marginRight: onShowDetails ? 22 : 0,
                }}
              >
                {name}
              </T>
            )}
          </View>
          {artwork && (
            <>
              <AssetImage
                source={artwork}
                style={{ width: "100%", height: 76 }}
                fallback={null}
              />
              <T
                style={{ fontSize: 14, fontWeight: "600", textAlign: "center" }}
              >
                {name}
              </T>
            </>
          )}
          {price && (
            <T style={[s.caption, artwork != null && { textAlign: "center" }]}>
              {price}
            </T>
          )}
          {detail && <T style={s.caption}>{detail}</T>}
        </View>
      </Tap>
      {onShowDetails && (
        <Tap
          padding="none"
          highlightRadius={22}
          style={{ position: "absolute", top: 0, right: 0 }}
          accessibilityLabel={`View ingredient details for ${name}`}
          onPress={onShowDetails}
        >
          <View
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name="information-circle-outline"
              sf="info.circle"
              size={17}
              color={colors.muted}
            />
          </View>
        </Tap>
      )}
    </View>
  );
}
