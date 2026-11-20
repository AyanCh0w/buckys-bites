import { useTheme } from "../../state/ThemeProvider";
import { NativeTabs } from "expo-router/native-tabs";
import { navigationIcons } from "../../lib/navigation-icons";
import { useHaptic } from "../../lib/haptics";

export default function TabsLayout() {
  const { colors } = useTheme();
  const playHaptic = useHaptic();
  return (
    <NativeTabs
      screenListeners={{
        tabPress: ({ data }) => {
          if (!data.isPrevented) playHaptic("select");
        },
      }}
      tintColor={colors.accent}
      labelStyle={{ fontSize: 14, fontFamily: "HelveticaNeue-MediumCond" }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          src={navigationIcons.home}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="menu"
        disableAutomaticContentInsets
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          src={navigationIcons.menu}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Menu</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="nutrition"
        disableAutomaticContentInsets
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          src={navigationIcons.nutrition}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Nutrition</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="ratings"
        disableAutomaticContentInsets
        disableTransparentOnScrollEdge
      >
        <NativeTabs.Trigger.Icon
          src={navigationIcons.ratings}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Ratings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon
          src={navigationIcons.me}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
