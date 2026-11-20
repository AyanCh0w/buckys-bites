import type {
  Catalog,
  MenuOption,
  ModifierGroup,
  Offering,
  SavedMenuSelection,
} from "./types";

// The station feed lists burger breads without limits and files lettuce wraps
// under vegetables. Keep its original option keys for the food-log RPC.
export function withBurgerBreadOptions(catalog: Catalog): Catalog {
  const burgers = new Set(
    catalog.foods
      .filter((food) => /burger\b/i.test(food.name))
      .map((food) => food.id),
  );
  return {
    ...catalog,
    offerings: catalog.offerings.map((offering) => {
      const groups = offering.modifier_groups;
      const bread = groups?.find((group) => group.name === "Bread and wraps");
      if (!burgers.has(offering.food_version_id) || !groups || !bread)
        return offering;
      const vegetables = groups.find((group) => group.name === "Vegetables");
      const wraps =
        vegetables?.options.filter((option) =>
          /^lettuce wrap$/i.test(option.label),
        ) ?? [];
      return {
        ...offering,
        modifier_groups: groups.flatMap((group) => {
          if (group === bread)
            return [
              { ...bread, max: 1, options: [...bread.options, ...wraps] },
            ];
          if (group !== vegetables || !wraps.length) return [group];
          const options = group.options.filter(
            (option) => !wraps.includes(option),
          );
          return options.length ? [{ ...group, options }] : [];
        }),
      };
    }),
  };
}

export function money(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function groupLimit(group: ModifierGroup) {
  if (group.max === 1) return "Choose one";
  if (group.min != null && group.min > 0 && group.max != null)
    return `Choose ${group.min}–${group.max}`;
  if (group.max != null) return `Choose up to ${group.max}`;
  if (group.min) return `Choose at least ${group.min}`;
  return "Choose any";
}

export function initialSize(offering?: Offering, requested?: string) {
  const sizes = offering?.serving_options ?? [];
  return (
    sizes.find((size) => size.label === requested)?.label ??
    sizes.find((size) => size.published_serving)?.label
  );
}

export function initialChoices(offering?: Offering, requested?: string) {
  if (requested != null) {
    try {
      const keys: unknown = JSON.parse(requested);
      const allowed = new Set(
        offering?.modifier_groups?.flatMap((group) =>
          group.options.map((option) => option.key),
        ),
      );
      if (
        Array.isArray(keys) &&
        new Set(keys).size === keys.length &&
        keys.every((key) => allowed.has(key)) &&
        validChoices(offering, keys)
      )
        return keys as string[];
    } catch {}
  }
  return (offering?.modifier_groups ?? []).flatMap((group) =>
    group.options
      .filter((option) => option.default)
      .map((option) => option.key),
  );
}

export function toggleChoice(
  choices: string[],
  group: ModifierGroup,
  option: MenuOption,
) {
  if (choices.includes(option.key)) {
    if (group.max === 1) return choices;
    return choices.filter((key) => key !== option.key);
  }
  const members = new Set(group.options.map((choice) => choice.key));
  if (group.max === 1)
    return [...choices.filter((key) => !members.has(key)), option.key];
  if (
    group.max != null &&
    choices.filter((key) => members.has(key)).length >= group.max
  )
    return choices;
  return [...choices, option.key];
}

export function savedChoiceKeys(
  offering: Offering,
  saved: SavedMenuSelection,
  loggedAsPublished = false,
) {
  // Older as-served logs stored no keys and the original food version.
  if (loggedAsPublished && !saved.choices.length)
    return initialChoices(offering);
  return (offering.modifier_groups ?? []).flatMap((group) => {
    const matches = group.options.filter((option) =>
      saved.choices.some(
        (choice) =>
          choice.label === option.label &&
          (choice.group === group.name ||
            (group.name === "Bread and wraps" &&
              choice.group === "Vegetables" &&
              /^lettuce wrap$/i.test(option.label))),
      ),
    );
    // A historical log may contain several breads from before the radio group.
    return matches
      .slice(0, group.max ?? matches.length)
      .map((option) => option.key);
  });
}

export function validChoices(
  offering: Offering | undefined,
  choices: string[],
) {
  return (offering?.modifier_groups ?? []).every((group) => {
    const count = group.options.filter((option) =>
      choices.includes(option.key),
    ).length;
    return (
      (group.min == null || count >= group.min) &&
      (group.max == null || count <= group.max)
    );
  });
}
