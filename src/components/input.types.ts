import type { TextInputProps } from "react-native";

export type InputProps = Pick<
  TextInputProps,
  | "value"
  | "defaultValue"
  | "onChangeText"
  | "placeholder"
  | "accessibilityLabel"
  | "autoFocus"
  | "editable"
  | "multiline"
  | "numberOfLines"
  | "keyboardType"
  | "autoCapitalize"
  | "autoCorrect"
  | "autoComplete"
  | "secureTextEntry"
  | "returnKeyType"
  | "maxLength"
  | "selectTextOnFocus"
  | "testID"
  | "style"
> & {
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
};
