/**
 * Block name → map color.
 * Ported from mcserver (src/map.js) so both tools render worlds the same way.
 */

export type RGB = readonly [number, number, number]

const DYE_COLORS: Record<string, RGB> = {
  white: [233, 236, 236], orange: [240, 118, 19], magenta: [189, 68, 179],
  light_blue: [58, 175, 217], yellow: [248, 198, 39], lime: [112, 185, 25],
  pink: [237, 141, 172], gray: [62, 68, 71], silver: [142, 142, 134],
  light_gray: [142, 142, 134], cyan: [21, 137, 145], purple: [121, 42, 172],
  blue: [53, 57, 157], brown: [114, 71, 40], green: [84, 109, 27],
  red: [161, 39, 34], black: [20, 21, 25],
}

const COLOR_RULES: [RegExp, RGB][] = [
  [/^(short_|tall)?grass$|grass_block|^turf/, [110, 160, 80]],
  [/water|bubble_column|kelp|seagrass/, [55, 95, 200]],
  [/lava|magma/, [212, 90, 18]],
  [/red_sand/, [190, 110, 45]],
  [/sandstone/, [216, 202, 157]],
  [/sand|suspicious_sand/, [219, 207, 163]],
  [/gravel/, [132, 127, 123]],
  [/deepslate/, [82, 82, 88]],
  [/diorite|calcite|quartz/, [188, 188, 190]],
  [/granite/, [154, 106, 89]],
  [/andesite|tuff|^stone$|cobblestone|smooth_stone|stone_(brick|stairs|slab)/, [126, 126, 126]],
  [/podzol|mycelium/, [110, 80, 60]],
  [/dirt|farmland|mud/, [134, 96, 67]],
  [/leaves|azalea|vine|bush|fern|flower|sapling|bamboo|cactus/, [64, 118, 46]],
  [/log|wood|stem|planks|fence|door|trapdoor/, [130, 102, 62]],
  [/snow|powder_snow/, [246, 248, 251]],
  [/^ice|packed_ice|blue_ice|frosted_ice/, [150, 195, 245]],
  [/netherrack|nether_brick/, [102, 48, 48]],
  [/end_stone/, [220, 222, 158]],
  [/obsidian/, [24, 18, 38]],
  [/bedrock/, [70, 70, 70]],
  [/coal_ore/, [70, 70, 70]],
  [/iron_ore/, [190, 160, 130]],
  [/glass/, [200, 220, 230]],
  [/glowstone|shroomlight|lantern|torch/, [235, 200, 110]],
  [/clay/, [160, 165, 178]],
  [/moss/, [90, 130, 55]],
]

export const AIR_BLOCKS = new Set([
  'minecraft:air', 'minecraft:cave_air', 'minecraft:void_air',
  'minecraft:structure_void', 'minecraft:light_block', 'minecraft:barrier',
])

const WATER_PATTERN = /^minecraft:(water|flowing_water|bubble_column)$/

export function isWater(name: string): boolean {
  return WATER_PATTERN.test(name)
}

const COLOR_CACHE_LIMIT = 4096
const colorCache = new Map<string, RGB>()

export function blockColor(fullName: string): RGB {
  const cached = colorCache.get(fullName)
  if (cached) return cached

  const name = fullName.replace(/^minecraft:/, '')
  let c: RGB | undefined

  // Dyed blocks (wool / concrete / terracotta / carpet) take the dye color
  if (/wool|concrete|terracotta|carpet|stained_glass|shulker/.test(name)) {
    for (const dye of Object.keys(DYE_COLORS)) {
      if (name.startsWith(dye + '_')) { c = DYE_COLORS[dye]; break }
    }
    c ??= [150, 100, 90]
  }
  if (!c) {
    for (const [re, rgb] of COLOR_RULES) {
      if (re.test(name)) { c = rgb; break }
    }
  }
  if (!c) {
    // Unknown blocks: spread across light grays by name hash so they stay distinguishable
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
    c = [120 + (h % 40), 115 + ((h >> 8) % 40), 110 + ((h >> 16) % 40)]
  }

  if (colorCache.size >= COLOR_CACHE_LIMIT) colorCache.clear()
  colorCache.set(fullName, c)
  return c
}

// ---------------------------------------------------------------------------
// Add-on blocks (minecraft:map_color)

/** null = defined by an add-on without minecraft:map_color, so it does not show up on the map */
export type CustomMapColor = { color: string; tintMethod?: string } | null

/** 'not_shown' blocks are skipped like air, revealing the block below (same as in-game maps) */
export type ResolvedColor = RGB | 'not_shown'

// Biome data is not read, so tint methods use fixed plains-like tints
const TINTS: Record<string, RGB> = {
  grass: [145, 189, 89],
  default_foliage: [119, 171, 47],
  birch_foliage: [128, 167, 85],
  evergreen_foliage: [97, 153, 97],
  dry_foliage: [160, 162, 106],
  water: [68, 175, 245],
}

export function createColorResolver(custom: Record<string, CustomMapColor>): (name: string) => ResolvedColor {
  const parsed = new Map<string, ResolvedColor>()
  for (const [id, entry] of Object.entries(custom)) {
    if (entry === null) {
      parsed.set(id, 'not_shown')
      continue
    }
    const rgb = parseHexColor(entry.color)
    if (!rgb) continue // invalid color: fall back to the default rules
    const tint = entry.tintMethod ? TINTS[entry.tintMethod] : undefined
    parsed.set(id, tint ? [rgb[0] * tint[0] / 255, rgb[1] * tint[1] / 255, rgb[2] * tint[2] / 255] : rgb)
  }
  return name => parsed.get(name) ?? blockColor(name)
}

function parseHexColor(value: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
