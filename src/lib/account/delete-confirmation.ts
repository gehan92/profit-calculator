/** The word a person types to confirm deleting their account (Part D2: "delete account (type DELETE)"). */
export const DELETE_CONFIRMATION_WORD = "DELETE";

/**
 * True when the typed text is the confirmation word. Spaces around it are
 * ignored; the letters must be the capital letters shown, so it can't be
 * typed by accident.
 */
export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_CONFIRMATION_WORD;
}
