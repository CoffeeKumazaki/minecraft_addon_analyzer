/** Directory patterns for Bedrock pack content categories */
export const CATEGORY_DIRS: Record<string, string[]> = {
  items: ['items/', 'bp/items/'],
  blocks: ['blocks/', 'bp/blocks/'],
  entities: ['entities/', 'bp/entities/'],
  recipes: ['recipes/', 'bp/recipes/'],
  lootTables: ['loot_tables/', 'bp/loot_tables/'],
  spawnRules: ['spawn_rules/', 'bp/spawn_rules/'],
  trading: ['trading/', 'bp/trading/'],
  functions: ['functions/', 'bp/functions/'],
  scripts: ['scripts/', 'bp/scripts/'],
  textures: ['textures/', 'rp/textures/'],
  animations: ['animations/', 'bp/animations/', 'rp/animations/'],
  animationControllers: ['animation_controllers/', 'bp/animation_controllers/', 'rp/animation_controllers/'],
  models: ['models/', 'rp/models/'],
  sounds: ['sounds/', 'rp/sounds/'],
}

/** Pack module types -> pack type mapping */
export const MODULE_TYPE_MAP: Record<string, 'behavior' | 'resource' | 'script'> = {
  data: 'behavior',
  resources: 'resource',
  script: 'script',
  client_data: 'resource',
  world_template: 'behavior',
}

/** Accepted file extensions */
export const ACCEPTED_EXTENSIONS = ['.mcaddon', '.mcpack', '.zip']
