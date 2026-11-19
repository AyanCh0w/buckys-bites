export const AVATARS = [
  { id: "classic", label: "Classic" },
  { id: "chef", label: "Chef" },
  { id: "scholar", label: "Scholar" },
  { id: "athlete", label: "Athlete" },
  { id: "music", label: "Music" },
  { id: "sunglasses", label: "Sunglasses" },
  { id: "beanie", label: "Beanie" },
  { id: "night-owl", label: "Night Owl" },
] as const;
export type AvatarId = (typeof AVATARS)[number]["id"];
export function isAvatarId(value: unknown): value is AvatarId {
  return AVATARS.some((avatar) => avatar.id === value);
}
export function avatarId(value: unknown): AvatarId {
  return isAvatarId(value) ? value : "classic";
}
export const avatarAsset = (value: unknown) => "icons/bucky-" + avatarId(value);
