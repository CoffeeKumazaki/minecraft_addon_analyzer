/**
 * Human-readable descriptions for common Minecraft Bedrock entity behaviors.
 * Keys are the behavior name without the "minecraft:" prefix.
 */
export const BEHAVIOR_DESCRIPTIONS: Record<string, { en: string; ja: string; category: string }> = {
  // Combat
  'behavior.melee_attack': { en: 'Melee attack', ja: '近接攻撃', category: 'combat' },
  'behavior.ranged_attack': { en: 'Ranged attack', ja: '遠距離攻撃', category: 'combat' },
  'behavior.nearest_attackable_target': { en: 'Targets nearby players/mobs', ja: '近くのプレイヤー/モブを攻撃対象にする', category: 'combat' },
  'behavior.hurt_by_target': { en: 'Retaliates when attacked', ja: '攻撃されると反撃する', category: 'combat' },
  'behavior.owner_hurt_by_target': { en: 'Defends its owner', ja: '飼い主が攻撃されると反撃する', category: 'combat' },
  'behavior.owner_hurt_target': { en: 'Attacks targets that hurt owner', ja: '飼い主が攻撃した対象を攻撃する', category: 'combat' },
  'behavior.knockback_roar': { en: 'Knockback roar', ja: 'ノックバック咆哮', category: 'combat' },
  'behavior.charge_attack': { en: 'Charge attack', ja: '突進攻撃', category: 'combat' },
  'behavior.leap_at_target': { en: 'Leaps at targets', ja: '対象に飛びかかる', category: 'combat' },

  // Movement
  'behavior.random_stroll': { en: 'Wanders randomly', ja: 'ランダムに歩き回る', category: 'movement' },
  'behavior.float': { en: 'Floats in water', ja: '水に浮く', category: 'movement' },
  'behavior.random_swim': { en: 'Swims randomly', ja: 'ランダムに泳ぐ', category: 'movement' },
  'behavior.random_fly': { en: 'Flies randomly', ja: 'ランダムに飛ぶ', category: 'movement' },
  'behavior.random_hover': { en: 'Hovers randomly', ja: 'ランダムにホバリングする', category: 'movement' },
  'behavior.random_look_around': { en: 'Looks around randomly', ja: 'ランダムに周囲を見渡す', category: 'movement' },
  'behavior.look_at_player': { en: 'Looks at nearby players', ja: '近くのプレイヤーを見つめる', category: 'movement' },
  'behavior.look_at_entity': { en: 'Looks at nearby entities', ja: '近くのエンティティを見つめる', category: 'movement' },
  'behavior.move_towards_target': { en: 'Moves toward target', ja: '対象に向かって移動する', category: 'movement' },
  'behavior.move_to_water': { en: 'Seeks water', ja: '水を探して移動する', category: 'movement' },
  'behavior.move_to_land': { en: 'Seeks land', ja: '陸地を探して移動する', category: 'movement' },
  'behavior.avoid_mob_type': { en: 'Avoids certain mobs', ja: '特定のモブを避ける', category: 'movement' },
  'behavior.flee_sun': { en: 'Flees from sunlight', ja: '日光から逃げる', category: 'movement' },
  'behavior.panic': { en: 'Panics when hurt', ja: '攻撃されるとパニックになる', category: 'movement' },
  'behavior.stay_while_sitting': { en: 'Stays while sitting', ja: 'お座りして待機する', category: 'movement' },
  'behavior.stroll_towards_village': { en: 'Walks toward villages', ja: '村に向かって歩く', category: 'movement' },
  'behavior.move_through_village': { en: 'Moves through village', ja: '村の中を移動する', category: 'movement' },
  'behavior.move_to_village': { en: 'Moves to village', ja: '村に移動する', category: 'movement' },
  'behavior.move_indoors': { en: 'Moves indoors', ja: '屋内に移動する', category: 'movement' },

  // Social
  'behavior.follow_owner': { en: 'Follows its owner', ja: '飼い主に追従する', category: 'social' },
  'behavior.follow_parent': { en: 'Follows parent', ja: '親に追従する', category: 'social' },
  'behavior.follow_mob': { en: 'Follows other mobs', ja: '他のモブに追従する', category: 'social' },
  'behavior.tempt': { en: 'Can be lured with items', ja: 'アイテムで誘導できる', category: 'social' },
  'behavior.breed': { en: 'Can breed', ja: '繁殖できる', category: 'social' },
  'behavior.make_love': { en: 'Can breed (villager)', ja: '繁殖できる（村人）', category: 'social' },
  'behavior.beg': { en: 'Begs for food', ja: '食べ物をねだる', category: 'social' },
  'behavior.trade_with_player': { en: 'Trades with players', ja: 'プレイヤーと取引する', category: 'social' },
  'behavior.nap': { en: 'Takes naps', ja: '昼寝をする', category: 'social' },
  'behavior.sleep': { en: 'Sleeps at night', ja: '夜に眠る', category: 'social' },

  // Actions
  'behavior.eat_block': { en: 'Eats blocks', ja: 'ブロックを食べる', category: 'action' },
  'behavior.eat_mob': { en: 'Eats other mobs', ja: '他のモブを食べる', category: 'action' },
  'behavior.lay_egg': { en: 'Lays eggs', ja: '卵を産む', category: 'action' },
  'behavior.lay_down': { en: 'Lies down', ja: '寝そべる', category: 'action' },
  'behavior.pickup_items': { en: 'Picks up items', ja: 'アイテムを拾う', category: 'action' },
  'behavior.drop_item_for': { en: 'Drops items for others', ja: 'アイテムを落としてあげる', category: 'action' },
  'behavior.harvest_farm_block': { en: 'Harvests crops', ja: '作物を収穫する', category: 'action' },
  'behavior.plant_farm_block': { en: 'Plants crops', ja: '作物を植える', category: 'action' },
  'behavior.open_door': { en: 'Opens doors', ja: 'ドアを開ける', category: 'action' },
  'behavior.stomp_attack': { en: 'Stomp attack', ja: '踏みつけ攻撃', category: 'action' },
  'behavior.swell': { en: 'Swells up before exploding', ja: '膨れて爆発する', category: 'action' },
  'behavior.explode': { en: 'Explodes', ja: '爆発する', category: 'action' },
  'behavior.summon_entity': { en: 'Summons entities', ja: 'エンティティを召喚する', category: 'action' },

  // Navigation
  'navigation.walk': { en: 'Walks on land', ja: '陸上を歩く', category: 'navigation' },
  'navigation.swim': { en: 'Swims in water', ja: '水中を泳ぐ', category: 'navigation' },
  'navigation.fly': { en: 'Flies through air', ja: '空中を飛ぶ', category: 'navigation' },
  'navigation.hover': { en: 'Hovers in air', ja: '空中でホバリングする', category: 'navigation' },
  'navigation.climb': { en: 'Climbs walls', ja: '壁を登る', category: 'navigation' },
  'navigation.float': { en: 'Floats in water', ja: '水に浮かぶ', category: 'navigation' },
  'navigation.generic': { en: 'Basic pathfinding', ja: '基本的な移動', category: 'navigation' },
}

export type BehaviorCategory = 'combat' | 'movement' | 'social' | 'action' | 'navigation'

export const CATEGORY_LABELS: Record<BehaviorCategory, { en: string; ja: string }> = {
  combat: { en: 'Combat', ja: '戦闘' },
  movement: { en: 'Movement', ja: '移動' },
  social: { en: 'Social', ja: '社会行動' },
  action: { en: 'Actions', ja: 'アクション' },
  navigation: { en: 'Navigation', ja: 'ナビゲーション' },
}
