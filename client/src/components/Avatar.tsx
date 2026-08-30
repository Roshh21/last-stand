import type { PlayerAvatar } from "@last-stand/shared";

const SHAPE_CLIP_PATHS: Partial<Record<PlayerAvatar["shape"], string>> = {
  triangle: "polygon(50% 0%, 0% 100%, 100% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
};

interface AvatarProps {
  avatar: PlayerAvatar;
  size?: number;
  title?: string;
}

/** Purely cosmetic identity marker - no gameplay meaning until Stage C's real elements land. */
export function Avatar({ avatar, size = 26, title }: AvatarProps) {
  const borderRadius = avatar.shape === "circle" ? "50%" : avatar.shape === "square" ? "4px" : "0";

  return (
    <span
      className="avatar"
      title={title}
      style={{
        width: size,
        height: size,
        background: avatar.color,
        borderRadius,
        clipPath: SHAPE_CLIP_PATHS[avatar.shape],
      }}
    />
  );
}
