import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import AccountPrompt from "../components/account-prompt";
import { backOrReplace } from "../lib/navigation";
import { useApp } from "../state/AppProvider";

export default function SignIn() {
  const { session } = useApp();
  useFocusEffect(
    useCallback(() => {
      if (session) backOrReplace();
    }, [session]),
  );
  return session ? null : <AccountPrompt />;
}
