// Development-only visual profile. Meals and reviews always require a real cloud session.
export const previewAccountEnabled =
  __DEV__ || process.env.EXPO_PUBLIC_PREVIEW_ACCOUNT === "true";
