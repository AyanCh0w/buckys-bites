export type ChoiceMenuProps = {
  label: string;
  accessibilityLabel?: string;
  options: { value: string; label: string }[];
  selected?: string;
  onSelect: (value: string) => void;
};
