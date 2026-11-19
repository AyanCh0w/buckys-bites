// Shared by the native and browser tab bars. Keep require paths static so Metro
// bundles all three image scales and resolves their 28-point intrinsic size.
export const navigationIcons = {
  home: {
    default: require("../../assets/navigation/home.png"),
    selected: require("../../assets/navigation/home-selected.png"),
  },
  menu: {
    default: require("../../assets/navigation/menu.png"),
    selected: require("../../assets/navigation/menu-selected.png"),
  },
  nutrition: {
    default: require("../../assets/navigation/nutrition.png"),
    selected: require("../../assets/navigation/nutrition-selected.png"),
  },
  ratings: {
    default: require("../../assets/navigation/ratings.png"),
    selected: require("../../assets/navigation/ratings-selected.png"),
  },
  me: {
    default: require("../../assets/navigation/me.png"),
    selected: require("../../assets/navigation/me-selected.png"),
  },
} as const;
