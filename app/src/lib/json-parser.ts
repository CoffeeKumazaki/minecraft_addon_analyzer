/**
 * Fault-tolerant JSON parser for Minecraft Bedrock add-on files.
 * Handles BOM, trailing commas, and single-line comments.
 */
export function parseJsonSafe(text: string): { data: unknown; error?: string } {
  // Step 1: Standard parse
  try {
    return { data: JSON.parse(text) }
  } catch {
    // Continue with cleanup
  }

  let cleaned = text

  // Step 2: Strip BOM
  if (cleaned.charCodeAt(0) === 0xFEFF) {
    cleaned = cleaned.slice(1)
  }

  try {
    return { data: JSON.parse(cleaned) }
  } catch {
    // Continue
  }

  // Step 3: Strip comments (single-line // and block /* */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
  cleaned = cleaned.replace(/\/\/.*$/gm, '')

  try {
    return { data: JSON.parse(cleaned) }
  } catch {
    // Continue
  }

  // Step 4: Strip trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  try {
    return { data: JSON.parse(cleaned) }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'JSON parse error' }
  }
}

/**
 * Decode Uint8Array to string (UTF-8)
 */
export function decodeText(data: Uint8Array): string {
  return new TextDecoder('utf-8').decode(data)
}
