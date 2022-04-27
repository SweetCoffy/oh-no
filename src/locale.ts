import { Category, MoveType } from "./moves"

type LocaleStringDamage = "dmg.generic" | "dmg.recoil" | "dmg.death" | "dmg.block" | "dmg.breakthrough" | "dmg.poison"
type LocaleStringMove = "move.use" | "move.miss" | "move.power" | "move.accuracy" | "move.category" | "move.type" | "move.recoil" | "move.userstat" | "move.targetstat" | "move.fail"
type LocaleStringStat = "stat.hp" | "stat.atk" | "stat.def" | "stat.spatk" | "stat.spdef" | "stat.spd"
type LocaleStringStatChange = "stat.change.rose" | "stat.change.fell" | "stat.change.rose.sharply" | "stat.change.fell.harshly"
| "stat.change.rose.drastically" | "stat.change.fell.severely"
type LocaleStringStatus = "status.poison.start" | "status.toxic.start"
type LocaleStringHeal = "heal.generic"
type LocaleStringItem = "item.shield.boost" | "item.shield.unboost"
export type LocaleString = LocaleStringDamage | LocaleStringMove | 
LocaleStringStat | LocaleStringStatChange | LocaleStringStatus | 
LocaleStringHeal | LocaleStringItem | Category | MoveType |
LocaleStringHeal
type LocaleStrings = {
    [key in LocaleString]?: string
}
export type LocaleID = "en_US" | "es_SP"| "owo"
export var locale: LocaleID = "en_US"
export type Locales = {
    [key in LocaleID]?: LocaleStrings
}
export var locales: Locales = {
    en_US: {},
}
// @ts-ignore
locales.owo = {...locales.en_US}
for (var k in locales.owo) {
    // @ts-ignore
    locales.owo[k] = locales.owo[k].replace(/(?<!\[\[)\b[^\[\]]+(?!\]\])/g, function(sub, str) {
        return sub.replace(/[rl]/g, "w").replace(/[RL]/g, "W")
    })
}
export function getString(key: string, obj: {[key: string]: any} = {}) {
    // @ts-ignore
    var str: string = locales[locale]?.[key]
    if (!str) return key
    return str.replace(/\[\[(\w+)\]\]/g, function(sub, k) {
        return obj[k] + ""
    })
}