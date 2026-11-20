import { Platform } from "react-native";

// Allow layout previews in the browser. Native development uses the normal sign-in flow.
export const previewAccountEnabled =
  (__DEV__ && Platform.OS === "web") ||
  process.env.EXPO_PUBLIC_PREVIEW_ACCOUNT === "true";
