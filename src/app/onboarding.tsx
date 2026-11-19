import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Onboarding } from "../components/onboarding";
import { useApp } from "../state/AppProvider";

export default function OnboardingScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { finishIntro, introComplete, userId } = useApp();
  const [leaving, setLeaving] = useState(false);
  // Wait for the route guards to reflect the persisted completion before leaving.
  useEffect(() => {
    if (!leaving || !introComplete) return;
    if (replay && userId) router.dismissTo("/");
    else router.replace(!userId ? "/auth" : "/");
  }, [leaving, introComplete, userId, replay]);
  return (
    <Onboarding
      replay={Boolean(replay)}
      onFinish={async () => {
        await finishIntro();
        setLeaving(true);
      }}
    />
  );
}
