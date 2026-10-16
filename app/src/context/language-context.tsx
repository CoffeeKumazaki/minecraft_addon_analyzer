import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type Language = 'en' | 'ja'

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
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
  'header.newAnalysis': { en: 'New Analysis', ja: '新しい解析' },
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

  const t = useCallback((key: string) => {
    return translations[key]?.[language] ?? key
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
