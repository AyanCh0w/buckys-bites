import type { TextStyle } from "react-native";

export const fontAssets = {
  "HelveticaNeue-MediumCond": require("../../assets/fonts/HelveticaNeue-MediumCondensed.otf"),
  "BDOGrotesk-Regular": require("../../assets/fonts/BDOGrotesk-Regular.ttf"),
  "BDOGrotesk-Medium": require("../../assets/fonts/BDOGrotesk-Medium.ttf"),
  "BDOGrotesk-DemiBold": require("../../assets/fonts/BDOGrotesk-DemiBold.ttf"),
  "BDOGrotesk-Bold": require("../../assets/fonts/BDOGrotesk-Bold.ttf"),
};
export const textSizes = { secondary: 14, body: 17, title: 28 } as const;
export const secondaryFont = "HelveticaNeue-MediumCond";
export const textSize = (size = 17) =>
  size <= 14
    ? textSizes.secondary
    : size <= 22
      ? textSizes.body
      : textSizes.title;
export function fontFamily(weight?: TextStyle["fontWeight"]) {
  if (weight === "bold" || Number(weight) >= 700) return "BDOGrotesk-Bold";
  if (Number(weight) >= 600) return "BDOGrotesk-DemiBold";
  if (Number(weight) >= 500) return "BDOGrotesk-Medium";
  return "BDOGrotesk-Regular";
}
