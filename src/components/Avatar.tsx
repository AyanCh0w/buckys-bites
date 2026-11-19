import { AssetImage } from "./ui";
import { assets } from "../data/assets";
import { AVATARS, avatarAsset, avatarId } from "../lib/avatars";

export function Avatar({
  value,
  size = 40,
}: {
  value?: unknown;
  size?: number;
}) {
  const label = AVATARS.find((a) => a.id === avatarId(value))!.label;
  return (
    <AssetImage
      source={assets[avatarAsset(value)]}
      style={{ width: size, height: size }}
      accessibilityLabel={`${label} Bucky avatar`}
    />
  );
}
