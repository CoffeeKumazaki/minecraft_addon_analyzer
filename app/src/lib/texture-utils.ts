/**
 * Shared utility for resolving Bedrock texture_data entry paths.
 * Used by both texture-extractor (addon textures) and vanilla-sprites (GitHub textures).
 */

/**
 * Resolve the `textures` field from a Bedrock texture_data entry to a file path.
 * Handles: string, array of strings, array of objects with `path`, single object with `path`.
 * Returns the path without file extension.
 */
export function resolveTexturePath(texField: unknown): string | null {
  let raw: string | null = null
  if (typeof texField === 'string') {
    raw = texField
  } else if (Array.isArray(texField) && texField.length > 0) {
    const first = texField[0]
    if (typeof first === 'string') raw = first
    else if (first && typeof first === 'object' && 'path' in first) {
      raw = String((first as Record<string, unknown>).path)
    }
  } else if (texField && typeof texField === 'object' && 'path' in (texField as Record<string, unknown>)) {
    raw = String((texField as Record<string, unknown>).path)
  }
  // Strip file extension — callers append .png or try multiple extensions
  return raw ? raw.replace(/\.(png|tga)$/i, '') : null
}
