/**
 * Which build this is. Stamped at compile time so a shop can read it back
 * over the phone — "1.0.0 · 62f8a23" is the difference between a support
 * call that starts with a fact and one that starts with a guess.
 */
export const APP_BUILD = __APP_BUILD__

/** One line, safe to read aloud. */
export function buildLabel(): string {
  return `${APP_BUILD.version} · ${APP_BUILD.commit} · ${APP_BUILD.date}`
}
