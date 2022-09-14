import { Category, MoveType } from "./moves"

type LocaleStringDamage = "dmg.generic" | "dmg.recoil" | "dmg.death" | "dmg.block" | "dmg.breakthrough" | "dmg.poison"
type LocaleStringMove = "move.use" | "move.miss" | "move.power" | "move.accuracy" | "move.category" | "move.type" | "move.recoil" | "move.userstat" | "move.targetstat" | "move.fail"
type LocaleStringStat = "stat.hp" | "stat.atk" | "stat.def" | "stat.spatk" | "stat.spdef" | "stat.spd"
type LocaleStringStatChange = "stat.change.rose" | "stat.change.fell" | "stat.change.rose.sharply" | "stat.change.fell.harshly"
| "stat.change.rose.drastically" | "stat.change.fell.severely"
type LocaleStringStatus = "status.poison.start" | "status.toxic.start"
type LocaleStringHeal = "heal.generic"
type LocaleStringItem = "item.shield.boost" | "item.shield.unboost"
type LocaleStringHunt = "hunt.threatening"
type LocaleStringOther = "enemy.appears"
export type LocaleString = LocaleStringDamage | LocaleStringMove | 
LocaleStringStat | LocaleStringStatChange | LocaleStringStatus | 
LocaleStringHeal | LocaleStringItem | Category | MoveType |
LocaleStringHunt | LocaleStringOther
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
    owo: {},
}
locales.owo = {}
export function getString(key: LocaleString, obj: {[key: string]: any} | string[] = {}) {
    // @ts-ignore
    var str: string = locales[locale]?.[key]
    if (!str) return key
    if (!Array.isArray(obj)) {
        for (let k in obj) {
            obj[k.toLowerCase()] = obj[k]
            delete obj[k]
        }
    }
    return str.replace(/\$\.(\w+)/g, function (sub, k) {
        //@ts-ignore
        return obj[k.toLowerCase()] + ""
    })
}
function owo(str: string) {
    return str.replace(/[rl]/g, "w")
        .replace(/od/g, "awd")
        .replace(/this/g, "dis")
        .replace(/you/g, "u")
        .replace(/ck\b/g, "k")
        .replace(/(.)\1/g, "$1")
        .replace(/([^aeiou])e\b/g, "$1")
        .replace(/y/g, "i")
        .replace(/ct([aeiou])/g, "sh$1")
        .replace(/([aeiou])s\b/g, "$1sh")
        .replace(/([aeiou])d\b/g, "$1wd")
        .replace(/s([aeiou])/g, "sh$1")
}
export function setupOwO() {
    //locales.owo = {}
    for (var k in locales.en_US) {
        // @ts-ignore
        if (k in locales.owo) continue
        // @ts-ignore
        locales.owo[k] = locales.en_US[k].replace(/(?<!\[)(?<!\$\.)\b\w+(?!\])/g, function (sub: string, str) {
            // oh my god
            // why did i make this
            let s = owo(sub.toLowerCase())
            return s
        })
    }
    console.log(locales.owo)
}