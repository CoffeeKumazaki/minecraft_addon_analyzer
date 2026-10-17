import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Language = 'en' | 'ja'

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translate a key; `{name}` placeholders are replaced from `vars` */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const translations: Record<string, Record<Language, string>> = {
  // SummaryCard badges
  'badge.recipes': { en: 'Recipes', ja: 'レシピ' },
  'badge.hostileMobs': { en: 'Hostile Mobs', ja: '敵対モブ' },
  'badge.foodItems': { en: 'Food', ja: '食べ物' },
  'badge.weapons': { en: 'Weapons', ja: '武器' },
  'badge.scriptUsage': { en: 'Uses Script', ja: 'Script使用' },
  // Units
  'unit.count': { en: '', ja: '個' },
  'unit.mobs': { en: '', ja: '体' },
  // contentFocus tags
  'focus.items': { en: 'Items', ja: 'アイテム追加' },
  'focus.blocks': { en: 'Blocks', ja: 'ブロック追加' },
  'focus.entities': { en: 'Mobs', ja: 'モブ追加' },
  // Header
  'header.newAnalysis': { en: 'New Analysis', ja: '新規解析' },
  'header.local': { en: 'Local analysis — files are never uploaded', ja: 'ローカル解析 — ファイルは送信されません' },
  // Upload
  'upload.drop': { en: 'Drop your add-on here', ja: 'ここにアドオンをドロップ' },
  'upload.dropping': { en: 'Release to analyze', ja: '離すと解析を開始します' },
  'upload.sub': { en: 'Behavior and resource packs can be loaded together', ja: 'Behavior Pack と Resource Pack はまとめて読み込めます' },
  'upload.choose': { en: 'Choose file', ja: 'ファイルを選択' },
  'upload.chooseOther': { en: 'Choose another file', ja: '別のファイルを選択' },
  'upload.analyzing': { en: 'Analyzing...', ja: '解析中…' },
  'upload.unsupported': { en: 'Unsupported file format. Accepts .mcaddon, .mcpack, .mcworld, .zip', ja: '対応していない形式です（.mcaddon / .mcpack / .mcworld / .zip）' },
  'upload.failed': { en: 'Analysis failed', ja: '解析に失敗しました' },
  // Workspace navigation
  'nav.contents': { en: 'CONTENTS', ja: 'CONTENTS' },
  'nav.world': { en: 'WORLD', ja: 'WORLD' },
  'nav.focus': { en: 'FOCUS', ja: 'FOCUS' },
  'nav.items': { en: 'Items', ja: 'アイテム' },
  'nav.blocks': { en: 'Blocks', ja: 'ブロック' },
  'nav.entities': { en: 'Entities', ja: 'エンティティ' },
  'nav.recipes': { en: 'Recipes', ja: 'レシピ' },
  'nav.map': { en: 'World Map', ja: 'ワールドマップ' },
  'nav.menu': { en: 'Pack & export', ja: 'パック・出力' },
  'sidebar.addPack': { en: 'Add {packs}', ja: '{packs} を追加' },
  'sidebar.merging': { en: 'Merging analysis...', ja: '解析を統合中…' },
  // List pane
  'list.search': { en: 'Search by name or ID', ja: '名前・IDで検索' },
  'list.all': { en: 'All', ja: 'すべて' },
  'list.empty': { en: 'Nothing here yet', ja: 'このカテゴリには何もありません' },
  'list.noMatch': { en: 'No {category} match "{query}"', ja: '「{query}」に一致する{category}はありません' },
  'list.clear': { en: 'Clear search', ja: '検索をクリア' },
  'list.col.name': { en: 'NAME', ja: 'NAME' },
  'list.col.hp': { en: 'HP', ja: 'HP' },
  'list.col.atk': { en: 'ATK', ja: 'ATK' },
  'list.col.tags': { en: 'TAGS', ja: 'TAGS' },
  'list.col.output': { en: 'OUTPUT', ja: 'OUTPUT' },
  'list.col.recipes': { en: 'RECIPES', ja: 'RECIPES' },
  'list.recipeCount': { en: '{recipes} recipes · {items} items', ja: '{recipes} レシピ · {items} アイテム' },
  // Detail pane
  'detail.select': { en: 'Select an entry from the list', ja: '一覧から選択すると詳細を表示します' },
  'detail.notFound': { en: 'Element not found', ja: '見つかりませんでした' },
  'detail.close': { en: 'Close', ja: '閉じる' },
  'detail.obtain': { en: 'Obtain {n}', ja: '入手 {n}' },
  'detail.usedIn': { en: 'Used in {n}', ja: '使用先 {n}' },
  'detail.issues': { en: '{n} issues', ja: '問題 {n}' },
  'detail.issue': { en: '1 issue', ja: '問題 1' },
  'tab.issues': { en: 'Issues', ja: '問題' },
  'issue.missing': { en: '{kind} not found', ja: '{kind}が見つかりません' },
  'issue.hint.texture': { en: 'No texture with this name in item_texture.json / terrain_texture.json, and no file under textures/ matches it', ja: 'item_texture.json / terrain_texture.json にこの名前がなく、textures/ 配下にも一致するファイルがありません' },
  'issue.hint.geometry': { en: 'No geometry with this identifier in models/', ja: 'models/ 配下にこの識別子のジオメトリがありません' },
  'issue.hint.animation': { en: 'No animation with this name in animations/', ja: 'animations/ 配下にこの名前のアニメーションがありません' },
  'issue.hint.file': { en: 'The referenced file is not in the pack', ja: '参照先のファイルがパック内にありません' },
  'refkind.icon': { en: 'Icon texture', ja: 'アイコンのテクスチャ' },
  'refkind.texture': { en: 'Texture', ja: 'テクスチャ' },
  'refkind.geometry': { en: 'Geometry', ja: 'ジオメトリ' },
  'refkind.animation': { en: 'Animation', ja: 'アニメーション' },
  'refkind.animation_controller': { en: 'Animation controller', ja: 'アニメーションコントローラー' },
  'refkind.loot_table': { en: 'Loot table', ja: 'ルートテーブル' },
  'refkind.sound': { en: 'Sound', ja: 'サウンド' },
  'detail.noIssues': { en: 'No issues', ja: '問題なし' },
  'tab.overview': { en: 'Overview', ja: '概要' },
  'tab.obtain': { en: 'Obtain', ja: '入手' },
  'tab.usedIn': { en: 'Used in', ja: '使用先' },
  'tab.references': { en: 'References', ja: '参照' },
  'tab.components': { en: 'Components', ja: 'コンポーネント' },
  'tab.textures': { en: 'Textures', ja: 'テクスチャ' },
  'tab.states': { en: 'States', ja: 'ステート' },
  'section.properties': { en: 'PROPERTIES', ja: 'PROPERTIES' },
  'section.obtain': { en: 'HOW TO OBTAIN', ja: 'HOW TO OBTAIN' },
  'section.usedIn': { en: 'USED IN', ja: 'USED IN' },
  'section.references': { en: 'REFERENCES', ja: 'REFERENCES' },
  'section.components': { en: 'COMPONENTS', ja: 'COMPONENTS' },
  'section.model': { en: '3D MODEL', ja: '3D MODEL' },
  'section.textures': { en: 'TEXTURES', ja: 'TEXTURES' },
  'section.states': { en: 'BLOCK STATES', ja: 'BLOCK STATES' },
  'section.inputs': { en: 'INPUTS', ja: 'INPUTS' },
  'section.warnings': { en: 'WARNINGS', ja: 'WARNINGS' },
  'detail.nothing': { en: 'Nothing to show', ja: '表示する情報はありません' },
  // Menu categories
  'category.construction': { en: 'Construction', ja: '建築' },
  'category.equipment': { en: 'Equipment', ja: '装備' },
  'category.items': { en: 'Items', ja: 'アイテム' },
  'category.nature': { en: 'Nature', ja: '自然' },
  'category.none': { en: 'Hidden', ja: '非表示' },
  'category.unset': { en: 'No category', ja: 'カテゴリなし' },
  // Property groups
  'prop.basic': { en: 'Basics', ja: '基本' },
  'prop.combat': { en: 'Weapon / Tool', ja: '武器・ツール' },
  'prop.armor': { en: 'Armor', ja: '防具' },
  'prop.food': { en: 'Food', ja: '食料' },
  'prop.use': { en: 'Use', ja: '使用' },
  'prop.projectile': { en: 'Projectile', ja: '投擲' },
  'prop.fuel': { en: 'Fuel', ja: '燃料' },
  'prop.physics': { en: 'Physics', ja: '物理' },
  'prop.light': { en: 'Light', ja: '光' },
  'prop.flammable': { en: 'Flammability', ja: '可燃性' },
  'prop.map': { en: 'Map', ja: '地図' },
  'prop.table': { en: 'Crafting table', ja: '作業台' },
  'prop.stack': { en: 'Stack size', ja: 'スタック' },
  'prop.rarity': { en: 'Rarity', ja: 'レアリティ' },
  'prop.damage': { en: 'Damage', ja: '攻撃力' },
  'prop.durability': { en: 'Durability', ja: '耐久値' },
  'prop.enchant': { en: 'Enchantable', ja: 'エンチャント' },
  'prop.slot': { en: 'Slot', ja: '部位' },
  'prop.protection': { en: 'Protection', ja: '防御力' },
  'prop.nutrition': { en: 'Nutrition', ja: '満腹度' },
  'prop.saturation': { en: 'Saturation', ja: '隠し満腹度' },
  'prop.alwaysEat': { en: 'Always edible', ja: '常に食べられる' },
  'prop.useDuration': { en: 'Use duration', ja: '使用時間' },
  'prop.movement': { en: 'Movement', ja: '移動速度' },
  'prop.cooldown': { en: 'Cooldown', ja: 'クールダウン' },
  'prop.entity': { en: 'Entity', ja: '発射体' },
  'prop.burnTime': { en: 'Burn time', ja: '燃焼時間' },
  'prop.miningTime': { en: 'Mining time', ja: '採掘時間' },
  'prop.blast': { en: 'Blast resistance', ja: '爆発耐性' },
  'prop.friction': { en: 'Friction', ja: '摩擦' },
  'prop.emission': { en: 'Emission', ja: '発光' },
  'prop.dampening': { en: 'Dampening', ja: '光の減衰' },
  'prop.catchChance': { en: 'Catch chance', ja: '着火率' },
  'prop.destroyChance': { en: 'Destroy chance', ja: '焼失率' },
  'prop.mapColor': { en: 'Color', ja: '地図色' },
  'prop.tint': { en: 'Tint', ja: '色合い' },
  'prop.tableName': { en: 'Name', ja: '名前' },
  'prop.events': { en: 'Events', ja: 'イベント' },
  'prop.onInteract': { en: 'On interact', ja: '右クリック時' },
  'prop.onStepOn': { en: 'On step on', ja: '踏んだ時' },
  'prop.onStepOff': { en: 'On step off', ja: '離れた時' },
  'section.drops': { en: 'DROPS', ja: 'DROPS' },
  'drops.rolls': { en: 'Rolls {n}', ja: '抽選 {n} 回' },
  'drops.none': { en: 'No drops', ja: 'ドロップなし' },
  'prop.yes': { en: 'Yes', ja: 'はい' },
  'prop.no': { en: 'No', ja: 'いいえ' },
  // Recipes
  'recipe.madeBy': { en: 'Made by {n} recipes', ja: '{n} つのレシピで作れます' },
  'recipe.madeByOne': { en: 'Made by 1 recipe', ja: '1 つのレシピで作れます' },
  'recipe.openItem': { en: 'Item details', ja: 'アイテム詳細' },
  'recipe.openBlock': { en: 'Block details', ja: 'ブロック詳細' },
  'recipe.template': { en: 'Template', ja: 'テンプレート' },
  'recipe.base': { en: 'Base', ja: 'ベース' },
  'recipe.addition': { en: 'Material', ja: '素材' },
  // Item tags
  'edible': { en: 'Edible', ja: '食べられる' },
  'wearable': { en: 'Wearable', ja: '装備可能' },
  'weapon': { en: 'Weapon', ja: '武器' },
  'tool': { en: 'Tool', ja: '道具' },
  'durable': { en: 'Durable', ja: '耐久値あり' },
  'placeable': { en: 'Placeable', ja: '設置可能' },
  'projectile': { en: 'Projectile', ja: '射出系' },
  'use_effect': { en: 'Use Effect', ja: '使用時効果あり' },
  'offhand': { en: 'Offhand', ja: 'オフハンド可' },
  // Entity tags
  'hostile': { en: 'Hostile', ja: '敵対的' },
  'neutral': { en: 'Neutral', ja: '中立' },
  'passive': { en: 'Passive', ja: '友好的' },
  'tameable': { en: 'Tameable', ja: 'テイム可能' },
  'breedable': { en: 'Breedable', ja: '繁殖可能' },
  'rideable': { en: 'Rideable', ja: 'ライド可能' },
  'flying': { en: 'Flying', ja: '飛行' },
  'aquatic': { en: 'Aquatic', ja: '水中行動' },
  'ranged': { en: 'Ranged', ja: '遠距離攻撃' },
  'melee': { en: 'Melee', ja: '近接攻撃' },
  'grows': { en: 'Grows', ja: '成長段階あり' },
  'transforms': { en: 'Transforms', ja: '変身/形態変化' },
  'event_driven': { en: 'Event Driven', ja: 'イベント駆動' },
  'spawn_rules': { en: 'Spawn Rules', ja: 'スポーン条件あり' },
  'loot_table': { en: 'Loot Table', ja: 'ルートテーブルあり' },
  'spawn_egg': { en: 'Spawn Egg', ja: 'スポーンエッグ' },
  // Block tags
  'destructible': { en: 'Destructible', ja: '破壊可能' },
  'transparent': { en: 'Transparent', ja: '透明' },
  'collision': { en: 'Collision', ja: '当たり判定あり' },
  'emissive': { en: 'Emissive', ja: '発光' },
  'directional': { en: 'Directional', ja: '方向性あり' },
  'state_change': { en: 'State Change', ja: '状態変化あり' },
  'interactive': { en: 'Interactive', ja: 'インタラクト可能' },
  'custom_geo': { en: 'Custom Geo', ja: '特殊形状' },
  // World map
  'map.title': { en: 'World Map', ja: 'ワールドマップ' },
  'map.overworld': { en: 'Overworld', ja: 'オーバーワールド' },
  'map.nether': { en: 'Nether', ja: 'ネザー' },
  'map.end': { en: 'End', ja: 'エンド' },
  'map.loading': { en: 'Opening world...', ja: 'ワールドを開いています...' },
  'map.spawn': { en: 'Go to spawn', ja: 'スポーン地点へ' },
  'map.hint': { en: 'Drag to pan, scroll to zoom', ja: 'ドラッグで移動・ホイールで拡大縮小' },
  'map.tileError': { en: 'Failed to read some areas', ja: '読み込めなかった範囲があります' },
  'map.retry': { en: 'Retry', ja: '再試行' },
  'map.jump': { en: 'Go', ja: '移動' },
  'map.entities': { en: 'Entities', ja: 'エンティティ' },
  'map.addonOnly': { en: 'Add-on only', ja: 'アドオンのみ' },
  'map.openEntityPage': { en: 'Open entity page', ja: 'エンティティページへ' },
  'map.close': { en: 'Close', ja: '閉じる' },
  'map.entitiesScope': { en: 'Shows entities and players saved in the 1.18.30+ format. Older-format entities and block entities (chests, signs, ...) are not shown.', ja: '1.18.30 以降の形式で保存されたエンティティとプレイヤーを表示します。旧形式のエンティティとブロックエンティティ（チェスト・看板など）は表示しません。' },
  'map.entitiesSkipped': { en: 'Unreadable entities', ja: '読めなかったエンティティ' },
  'map.entitiesTruncated': { en: 'Too many entities; some are not shown', ja: 'エンティティが多すぎるため一部を表示していません' },
}

function formatCount(count: number, type: 'items' | 'mobs', lang: Language): string {
  if (lang === 'ja') {
    return `${count}${type === 'mobs' ? '体' : '個'}`
  }
  return String(count)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('addon-analyzer-lang')
    return (saved === 'ja' || saved === 'en') ? saved : 'en'
  })

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('addon-analyzer-lang', lang)
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const text = translations[key]?.[language] ?? key
    if (!vars) return text
    return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

export { formatCount }
