// Native Apple sign-in is the only account option and requires a supported
// iOS device. Other platforms direct users to the iPhone app.
export async function signInWithApple(): Promise<never> {
  throw new Error("Sign in with Apple is available in the iPhone app.");
}
