import { BattleType } from "./battle"
import { Category, MoveType } from "./moves"
import { StatID } from "./stats"

type LocaleStringDamage = "dmg.release" | "dmg.generic" | "dmg.recoil" | "dmg.death" | "dmg.block" | "dmg.breakthrough" | "dmg.poison" | "dmg.overkill" | "dmg.none" | "dmg.rng"
type LocaleStringMove = "move.use" | "move.miss" | "move.power" | "move.accuracy" | "move.category" | "move.type" | "move.recoil" | "move.userstat" | "move.targetstat" | "move.fail"
type LocaleStringStat = `stat.${StatID}`
type LocaleStringStatChange = "stat.change.rose" | "stat.change.fell" | "stat.change.rose.sharply" | "stat.change.fell.harshly"
| "stat.change.rose.drastically" | "stat.change.fell.severely"
type LocaleStringStatus = "status.poison.start" | "status.toxic.start" | "status.california.start" | "status.bleed.start" | "status.opposite_day.start"
type LocaleStringHeal = "heal.generic" | "heal.eggs" | "heal.regeneration" | "heal.revive"
type LocaleStringItem = "item.shield.boost" | "item.shield.unboost" | "item.mirror.perfect" | "item.mirror.reflect" | "item.mirror.shatter" | "item.mirror.shards"
type LocaleStringHunt = "hunt.threatening"
type LocaleStringOther = "enemy.appears"
type LocaleStringAbility = "ability.massive_health_bar"
type LocaleStringBattleType = `battle.${BattleType}`
export type LocaleString = LocaleStringDamage | LocaleStringMove | 
    LocaleStringStat | LocaleStringStatChange | LocaleStringStatus | 
    LocaleStringHeal | LocaleStringItem | Category | MoveType |
    LocaleStringHunt | LocaleStringOther | LocaleStringAbility |
    LocaleStringBattleType
type LocaleStrings = {
    [key in LocaleString]?: string
}
export type LocaleID = "en_US" | "es_SP"
export let locale: LocaleID = "en_US"
export type Locales = {
    [key in LocaleID]?: LocaleStrings
}
export let locales: Locales = {
    en_US: {},
}
export function getString(key: LocaleString, obj: {[key: string]: any} | string[] = {}) {
    // @ts-ignore
    let str: string = locales[locale]?.[key]
    if (!str) return key
    if (!Array.isArray(obj)) {
        for (let k in obj) {
            let v = obj[k]
            delete obj[k]
            obj[k.toLowerCase()] = v
        }
    }
    return str.replace(/\$\.(\w+)/g, function (sub, k) {
        //@ts-ignore
        return obj[k.toLowerCase()] + ""
    })
}