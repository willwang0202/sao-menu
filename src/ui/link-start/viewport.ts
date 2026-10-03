/** All scenes are authored in the source clip's 1920×1080 space and cover the display like the original film. */
export const REF_WIDTH = 1920;
export const REF_HEIGHT = 1080;

export type Cover = Readonly<{ scale: number; x: number; y: number }>;

export function coverTransform(width: number, height: number): Cover {
  const scale = Math.max(width / REF_WIDTH, height / REF_HEIGHT);
  return { scale, x: (width - REF_WIDTH * scale) / 2, y: (height - REF_HEIGHT * scale) / 2 };
}
