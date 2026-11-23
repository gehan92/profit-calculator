/**
 * Profile photo rules (Account → Profile). A photo is one small picture in the
 * Storage bucket "avatars", in a folder named after the person's id, under a
 * random file name (migration 0011): "<user id>/<random>.webp".
 */
export const AVATAR_BUCKET = "avatars";

/** The picture is cut to a square and drawn this many pixels wide before it is sent. */
export const AVATAR_SIZE = 256;

/** The bucket accepts at most 500 KB; a 256 px picture is far smaller. */
export const AVATAR_MAX_BYTES = 512 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** True for "<this person's id>/<random>.webp": the only place this person may keep a photo. */
export function isAvatarPath(path: string, userId: string): boolean {
  const own = new RegExp(`^${UUID}/${UUID}\\.webp$`, "i");
  return own.test(path) && path.startsWith(`${userId}/`);
}

/** A new random file name for this person's next photo. */
export function newAvatarPath(userId: string, random: string = crypto.randomUUID()): string {
  return `${userId}/${random}.webp`;
}
