import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const {
  AndroidHaptics: android,
  ImpactFeedbackStyle: impact,
  NotificationFeedbackType: notice,
} = Haptics;
const androidApi = Platform.OS === "android" ? Number(Platform.Version) : 0;
const confirm = androidApi >= 30 ? android.Confirm : android.Context_Click;

// Keep browsing light. Attaching something has a crisp edge, releasing it is
// soft, and a meal landing in the log has more weight than either.
const effects = {
  tap: {
    ios: () => Haptics.impactAsync(impact.Light),
    android: android.Virtual_Key,
    web: 8,
  },
  select: {
    ios: () => Haptics.selectionAsync(),
    android: androidApi >= 34 ? android.Segment_Tick : android.Clock_Tick,
    web: 5,
  },
  attach: {
    ios: () => Haptics.impactAsync(impact.Rigid),
    android: androidApi >= 34 ? android.Toggle_On : android.Context_Click,
    web: 14,
  },
  release: {
    ios: () => Haptics.impactAsync(impact.Soft),
    android: androidApi >= 34 ? android.Toggle_Off : android.Clock_Tick,
    web: 6,
  },
  addFood: {
    ios: () => Haptics.impactAsync(impact.Medium),
    android: confirm,
    web: [18, 40, 7],
  },
  success: {
    ios: () => Haptics.notificationAsync(notice.Success),
    android: confirm,
    web: [7, 45, 16],
  },
  error: {
    ios: () => Haptics.notificationAsync(notice.Error),
    android: androidApi >= 30 ? android.Reject : android.Long_Press,
    web: [14, 45, 14],
  },
};

export type HapticCue = keyof typeof effects;
type PlayHaptic = (cue: HapticCue) => void;
export const HapticContext = createContext<PlayHaptic>(() => {});
export const useHaptic = () => useContext(HapticContext);

async function playEffect(cue: HapticCue) {
  const effect = effects[cue];
  if (Platform.OS === "ios") return effect.ios();
  if (Platform.OS === "android")
    return Haptics.performAndroidHapticsAsync(effect.android);
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    navigator.vibrate?.(effect.web);
  }
}

export function useHapticPlayer(enabled: boolean): PlayHaptic {
  const preference = useRef(enabled);
  useLayoutEffect(() => {
    preference.current = enabled;
  }, [enabled]);

  return useCallback((cue: HapticCue) => {
    // An async save can finish after the user changes their preference.
    if (preference.current) void playEffect(cue).catch(() => {});
  }, []);
}
