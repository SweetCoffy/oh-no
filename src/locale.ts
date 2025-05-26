import { BattleType } from "./battle"
import { Category, DamageType, MoveType } from "./moves"
import { StatID } from "./stats"

type LocaleStringDamage = "dmg.crit" | "dmg.plotarmor" | "dmg.release" | "dmg.generic" | "dmg.recoil" | "dmg.death" | "dmg.block" | "dmg.breakthrough" | "dmg.poison" | "dmg.overkill" | "dmg.none" | "dmg.rng" | "dmg.bleed"
type LocaleStringMove = "move.use" | "move.miss" | "move.power" | "move.accuracy" | "move.category" | "move.type" | "move.recoil" | "move.userstat" | "move.targetstat" | "move.fail"
type LocaleStringMoveInfo = `move.category.${Category}` | `move.dmgtype.${DamageType}`
type LocaleStringStat = `stat.${StatID}`
type LocaleStringStatChange = "stat.change.rose" | "stat.change.fell" | "stat.change.rose.sharply" | "stat.change.fell.harshly"
    | "stat.change.rose.drastically" | "stat.change.fell.severely"
type LocaleStringStatus = "status.poison.start" | "status.toxic.start" | "status.california.start" | "status.bleed.start" | "status.opposite_day.start" | "status.rush.start"
type LocaleStringHeal = "heal.generic" | "heal.eggs" | "heal.regeneration" | "heal.revive" | "heal.uk"
type LocaleStringItem = "item.shield.boost" | "item.shield.unboost" | "item.mirror.perfect" | "item.mirror.reflect" | "item.mirror.shatter" | "item.mirror.shards"
type LocaleStringHunt = "hunt.threatening"
type LocaleStringOther = "enemy.appears"
type LocaleStringAbility = "ability.massive_health_bar" | "ability.beserker_soul"
type LocaleStringBattleType = `battle.${BattleType}`
export type LocaleString = LocaleStringDamage | LocaleStringMove |
    LocaleStringStat | LocaleStringStatChange | LocaleStringStatus |
    LocaleStringHeal | LocaleStringItem | Category | MoveType |
    LocaleStringHunt | LocaleStringOther | LocaleStringAbility |
    LocaleStringBattleType | LocaleStringMoveInfo
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
export function getString(key: string, obj: { [key: string]: any } | string[] = {}) {
    // @ts-ignore
    let str: string = locales[locale]?.[key]
    // @ts-ignore
    if (!str) str = locales.en_US?.[key]
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