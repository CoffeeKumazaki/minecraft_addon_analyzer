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

export type ItemSpec = {
  id: string;
  title?: string;
  sourcePath: string;
  icon?: string;
  tags: string[];
  components: Record<string, unknown>;
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

export type BlockSpec = {
  id: string;
  title?: string;
  sourcePath: string;
  tags: string[];
  textures: string[];
  states?: string[];
  components: Record<string, unknown>;
  references: ReferenceLink[];
  diagnostics: Diagnostic[];
};

export type EntitySpec = {
  id: string;
  title?: string;
  sourcePath: string;
  family?: string[];
  tags: string[];
  health?: number;
  movement?: number;
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

export type LootTableSpec = {
  sourcePath: string;
  entries: string[];
  diagnostics: Diagnostic[];
};

export type SpawnRuleSpec = {
  id: string;
  sourcePath: string;
  entityId: string;
  conditions: string[];
  diagnostics: Diagnostic[];
};

export type TradeSpec = {
  sourcePath: string;
  entityId?: string;
  tiers: number;
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

export type SummarySpec = {
  shortDescription: string;
  contentFocus: string[];
  gameplayImpact: 'low' | 'medium' | 'high' | 'unknown';
  scriptUsage: boolean;
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
