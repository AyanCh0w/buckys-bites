import type { AppleSignInProps } from "./apple-sign-in.types";
import { useTheme } from "../state/ThemeProvider";
import { T } from "./ui";

export default function AppleSignIn(_props: AppleSignInProps) {
  const { s } = useTheme();
  return (
    <T style={[s.body, { textAlign: "center" }]}>
      Open Bucky’s Bites on your iPhone to sign in with Apple.
    </T>
  );
}
