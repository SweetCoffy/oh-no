import { Category, MoveType } from "./moves"

type LocaleStringDamage = "dmg.generic" | "dmg.recoil" | "dmg.death" | "dmg.block" | "dmg.breakthrough" | "dmg.poison"
type LocaleStringMove = "move.use" | "move.miss" | "move.power" | "move.accuracy" | "move.category" | "move.type" | "move.recoil" | "move.userstat" | "move.targetstat"
type LocaleStringStat = "stat.hp" | "stat.atk" | "stat.def" | "stat.spatk" | "stat.spdef" | "stat.spd"
type LocaleStringStatChange = "stat.change.rose" | "stat.change.fell" | "stat.change.rose.sharply" | "stat.change.fell.harshly"
type LocaleStringStatus = "status.poison.start" | "status.toxic.start"
type LocaleStringHeal = "heal.generic"
type LocaleStringItem = "item.shield.boost" | "item.shield.unboost"
export type LocaleString = LocaleStringDamage | LocaleStringMove | LocaleStringStat | LocaleStringStatChange | LocaleStringStatus | LocaleStringHeal | LocaleStringItem | Category | MoveType
type LocaleStrings = {
    [key in LocaleString]: string
}
export type LocaleID = "en_US" | "owo"
export var locale: LocaleID = "en_US"
export type Locales = {
    [key in LocaleID]?: LocaleStrings
}
export var locales: Locales = {
    en_US: {
        "dmg.generic": "[[USER]] took [[DAMAGE]] damage!",
        "dmg.recoil": "[[USER]] took [[DAMAGE]] damage from the recoil!",
        "dmg.death": "[[USER]] Died",
        "dmg.block": "[[USER]] Blocked [[DAMAGE]] damage!",
        "dmg.breakthrough": "It broke through [[USER]]'s protection!",
        "dmg.poison": "[[USER]] Takes [[DAMAGE]] damage from the poison!",

        "heal.generic": "[[USER]] Restored [[AMOUNT]] HP!",

        "move.use": "[[USER]] Used [[MOVE]]!",
        "move.miss": "But it missed...",
        "move.power": "Power: [[VALUE]]",
        "move.accuracy": "Accuracy: [[VALUE]]",
        "move.category": "Category: [[VALUE]]",
        "move.type": "Type: [[VALUE]]",
        "move.recoil": "Recoil: [[VALUE]]%",
        "move.userstat": "User stat changes:",
        "move.targetstat": "Target stat changes:",

        "physical": "Physical",
        "special": "Special",
        "status": "Status",
        "attack": "Attack",
        "noop": 'No-Op',
        "protect": "Protect",

        "stat.atk": "Attack",
        "stat.def": "Defense",
        "stat.spatk": "Special Attack",
        "stat.spdef": "Special Defense",
        "stat.hp": "HP",
        "stat.spd": "Speed",

        "stat.change.rose": "[[USER]]'s [[STAT]] rose!",
        "stat.change.rose.sharply": "[[USER]]'s [[STAT]] rose sharply!",
        "stat.change.fell": "[[USER]]'s [[STAT]] fell!",
        "stat.change.fell.harshly": "[[USER]]'s [[STAT]] fell harshly!",

        "status.poison.start": "[[USER]] has been poisoned!",
        "status.toxic.start": "[[USER]] has been badly poisoned!",

        "item.shield.boost": "[[USER]]'s Shield is now active",
        "item.shield.unboost": "[[USER]]'s Shield is no longer active",
    },
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