// Santa Clara University brand palette: https://www.scu.edu/umc/brand/colors/
export const brand = {
  santaClaraRed: "#A32035",
  broncoRed: "#862633",
  white: "#FFFFFF",
  black: "#000000",
  stone: "#758592",
  terracotta: "#D15C3B",
  terracottaDark: "#B13E13",
  sunrise: "#FFB600",
  sunriseDark: "#C97900",
  palm: "#55712E",
  palmDark: "#27540C",
  agave: "#4D8798",
  agaveDark: "#115D6F",
  sky: "#4974BB",
  wisteria: "#7F5E9C",
  fog: "#E0DAD3",
  fogLight: "#EFECE9",
  fogDark: "#B5B1AC",
  adobeLight: "#F8F3E5",
  slate: "#425766",
  slateLight: "#D0D5D9",
  slateDark: "#2A373F",
};
export const lightColors = {
  ink: brand.black,
  muted: brand.slate,
  faint: brand.stone,
  rule: brand.fogLight,
  paper: brand.white,
  canvas: brand.fogLight,
  accent: brand.santaClaraRed,
  accentLight: "#A320350C",
  red: brand.broncoRed,
  ivory: brand.adobeLight,
  surface: "#FFFFFF",
  selected: "#FFFFFF",
  pressed: brand.fogLight,
  glass: "#FFFFFFC9",
  glassBorder: "#FFFFFFB0",
  onAccent: "#FFFFFF",
  action: brand.santaClaraRed,
  positive: brand.palmDark,
  protein: brand.palm,
  carbs: brand.sunriseDark,
  fat: brand.wisteria,
  chartEmpty: brand.slateLight,
};
export type ThemeColors = typeof lightColors;
export const darkColors: ThemeColors = {
  ink: "#F5F5F7",
  muted: "#B5BEC6",
  faint: "#939DA7",
  rule: "#323235",
  paper: "#111113",
  canvas: "#242426",
  accent: "#F08091",
  accentLight: "#F080911A",
  red: "#FF929B",
  ivory: "#302B21",
  surface: "#1C1C1E",
  selected: "#3A3A3C",
  pressed: "#303033",
  glass: "#202023D9",
  glassBorder: "#FFFFFF24",
  onAccent: "#FFFFFF",
  // Keep filled actions in SCU red; use its lighter tint for text and icons.
  action: brand.santaClaraRed,
  positive: "#B3CE91",
  protein: "#A4C878",
  carbs: "#F0B24F",
  fat: "#C3A2E0",
  chartEmpty: "#55555B",
};
export const kitchenStyle = (name = "") => ({
  accent: /parr?illa|slice|fire/i.test(name)
    ? brand.terracottaDark
    : /oasis|garden/i.test(name)
      ? brand.palmDark
      : /grill/i.test(name)
        ? brand.agaveDark
        : brand.santaClaraRed,
});
export function kitchenKey(name: string) {
  if (/parilla|parrilla/i.test(name)) return "la-parrilla";
  if (/global grill/i.test(name)) return "global-grill";
  if (/^(poke\s*&\s*)?sushi$/i.test(name)) return "sushi";
  if (/^mission bakery(?: cafe)?$/i.test(name)) return "mission-bakery";
  if (/^(the )?fire( grill)?$/i.test(name)) return "fire";
  if (/^(the )?chef['’]?s? table$/i.test(name)) return "chef-s-table";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^the /, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
}
export function kitchenName(name: string) {
  if (/parilla|parrilla/i.test(name)) return "La Parrilla";
  if (/global grill/i.test(name)) return "The Global Grill";
  return name;
}
