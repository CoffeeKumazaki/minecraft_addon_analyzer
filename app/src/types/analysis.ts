// Internal data model based on spec Section 12

export type AnalysisResult = {
  addon: AddonSummary;
  packs: PackInfo[];
  items: ItemSpec[];
  blocks: BlockSpec[];
  entities: EntitySpec[];
  recipes: RecipeSpec[];
  lootTables: LootTableSpec[];
  spawnRules: SpawnRuleSpec[];
  trades: TradeSpec[];
  scripts: ScriptSpec[];
  assets: AssetSpec[];
  warnings: Diagnostic[];
  summary: SummarySpec;
};

export type AddonSummary = {
  name: string;
  description?: string;
  packTypes: PackType[];
  versions: string[];
  minEngineVersion?: string;
  dependencies: DependencySpec[];
  iconUrl?: string;
};

export type PackType = 'behavior' | 'resource' | 'script';

export type DependencySpec = {
  uuid: string;
  version: string;
  moduleName?: string;
};

export type PackModule = {
  type: string;
  uuid: string;
  version: string;
  description?: string;
  entry?: string; // script entry point
};

export type PackInfo = {
  name: string;
  type: 'behavior' | 'resource' | 'mixed' | 'unknown';
  path: string;
  uuid?: string;
  version?: string;
  minEngineVersion?: string;
  modules: PackModule[];
  dependencies: DependencySpec[];
};

export type ItemStats = {
  maxStackSize?: number;
  rarity?: string;
  damage?: number;
  durability?: number;
  enchantable?: { slot: string; value: number };
  food?: { nutrition: number; saturation?: string; canAlwaysEat?: boolean };
  armor?: { slot: string; protection: number };
  fuel?: number;
  cooldown?: { category: string; duration: number };
  projectile?: string;
  useModifiers?: { useDuration?: number; movementModifier?: number };
};

export type ItemSpec = {
  id: string;
  title?: string;
  sourcePath: string;
  icon?: string;
  tags: string[];
  components: Record<string, unknown>;
  stats: ItemStats;
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

export type BlockStats = {
  miningTime?: number;
  blastResistance?: number;
  lightEmission?: number;
  lightDampening?: number;
  friction?: number;
  flammable?: boolean | { catchChance: number; destroyChance: number };
  mapColor?: string;
  craftingTable?: { tableName: string; tags: string[] };
  onInteract?: string;
  onStepOn?: string;
  onStepOff?: string;
};

export type BlockSpec = {
  id: string;
  title?: string;
  sourcePath: string;
  tags: string[];
  textures: string[];
  faceTextures?: Record<string, string>;
  states?: string[];
  lootTable?: string;
  components: Record<string, unknown>;
  stats: BlockStats;
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

export type SpawnEggInfo = {
  texture?: string;
  textureIndex?: number;
  baseColor?: string;
  overlayColor?: string;
};

export type EntitySpec = {
  id: string;
  title?: string;
  sourcePath: string;
  family?: string[];
  tags: string[];
  health?: number;
  attackDamage?: number;
  movement?: number;
  spawnEgg?: SpawnEggInfo;
  behaviors: string[];
  events: string[];
  componentGroups: string[];
  textures: string[];
  geometries: string[];
  animations: string[];
  lootTables: string[];
  spawnRules: string[];
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

export type RecipeSpec = {
  id?: string;
  recipeType: string;
  sourcePath: string;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
  pattern?: string[];
  key?: Record<string, RecipeIO>;
  tags: string[];
  diagnostics: Diagnostic[];
};

export type RecipeIO = {
  item: string;
  count?: number;
  data?: number;
};

export type LootTableDrop = {
  item: string;
  title?: string;       // resolved display name
  chance: number;       // 0–1 probability within the pool
  countMin: number;
  countMax: number;
  conditions: string[]; // pool-level conditions
  functions: string[];  // entry-level function names
};

export type LootTablePool = {
  rollsMin: number;
  rollsMax: number;
  conditions: string[];
  drops: LootTableDrop[];
};

export type LootTableSpec = {
  sourcePath: string;
  pools: LootTablePool[];
  diagnostics: Diagnostic[];
};

export type SpawnCondition = {
  biomes?: string[];
  dimension?: string;
  lightRange?: { min: number; max: number };
  heightRange?: { min: number; max: number };
  spawnsOnSurface?: boolean;
  spawnsUnderground?: boolean;
  spawnsUnderwater?: boolean;
  spawnsOnGround?: boolean;
  difficultyFilter?: { min?: string; max?: string };
  weight?: number;
  herdSize?: { min: number; max: number };
  raw: string[];
};

export type SpawnRuleSpec = {
  id: string;
  sourcePath: string;
  entityId: string;
  populationControl?: string;
  conditions: SpawnCondition[];
  diagnostics: Diagnostic[];
};

export type TradeItem = {
  item: string;
  quantity?: number;
  title?: string;
};

export type TradeTier = {
  trades: { wants: TradeItem[]; gives: TradeItem[] }[];
};

export type TradeSpec = {
  sourcePath: string;
  entityId?: string;
  tiers: TradeTier[];
  diagnostics: Diagnostic[];
};

export type ScriptSpec = {
  sourcePath: string;
  imports: string[];
  apiHints: string[];
  events: string[];
  commands: string[];
  diagnostics: Diagnostic[];
};

export type AssetSpec = {
  sourcePath: string;
  kind: 'texture' | 'geometry' | 'animation' | 'animation_controller' | 'sound' | 'other';
  identifiers: string[];
};

export type ReferenceLink = {
  kind: string;
  target: string;
  resolved: boolean;
};

export type DiagnosticLevel = 'error' | 'warning' | 'info';

export type Diagnostic = {
  level: DiagnosticLevel;
  code: string;
  message: string;
  path?: string;
};

export type DetailCounts = {
  recipes: number;
  hostileMobs: number;
  foodItems: number;
  weapons: number;
};

export type SummarySpec = {
  shortDescription: string;
  contentFocus: string[];
  gameplayImpact: 'low' | 'medium' | 'high' | 'unknown';
  scriptUsage: boolean;
  detailCounts: DetailCounts;
};

// Virtual file system type
export type VirtualFS = Map<string, Uint8Array>;

// File index - files categorized by directory
export type FileIndex = {
  items: string[];
  blocks: string[];
  entities: string[];
  clientEntities: string[];
  recipes: string[];
  lootTables: string[];
  spawnRules: string[];
  trading: string[];
  functions: string[];
  scripts: string[];
  textures: string[];
  animations: string[];
  animationControllers: string[];
  models: string[];
  sounds: string[];
  other: string[];
};
