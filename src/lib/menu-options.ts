import type { MenuOption, ModifierGroup, Offering } from "./types";

export function money(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function groupLimit(group: ModifierGroup) {
  if (group.min === 1 && group.max === 1) return "Choose one";
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
    if (group.min === 1 && group.max === 1) return choices;
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
