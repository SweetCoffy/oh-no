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
    [key in LocaleString]: string
}
export type LocaleID = "en_US" | "owo"
export var locale: LocaleID = "en_US"
export type Locales = {
    [key in LocaleID]?: LocaleStrings
}
export var locales: Locales = {
    en_US: {
        "dmg.generic": "[blue][[USER]][red] took [[DAMAGE]] damage!",
        "dmg.recoil": "[blue][[USER]][red] took [[DAMAGE]] damage from the recoil!",
        "dmg.death": "[blue][[USER]][red] Died",
        "dmg.block": "[blue][[USER]][reset] Blocked [red][[DAMAGE]][reset] damage!",
        "dmg.breakthrough": "It broke through [blue][[USER]][red]'s protection!",
        "dmg.poison": "[blue][[USER]][red] Takes [[DAMAGE]] damage from the poison!",

        "heal.generic": "[blue][[USER]][green] Restored [[AMOUNT]] HP!",

        "move.use": "[blue][[USER]][reset] Used [[MOVE]]!",
        "move.miss": "But it missed...",
        "move.fail": "It failed",
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
        "heal": "Heal",

        "stat.atk": "Attack",
        "stat.def": "Defense",
        "stat.spatk": "Special Attack",
        "stat.spdef": "Special Defense",
        "stat.hp": "HP",
        "stat.spd": "Speed",

        "stat.change.rose": "[blue][[USER]][reset]'s [blue][[STAT]][reset] rose!",
        "stat.change.rose.sharply": "[blue][[USER]][green]'s [blue][[STAT]][green] rose sharply!",
        "stat.change.rose.drastically": "[blue][[USER]][green]'s [blue][[STAT]][green] rose drastically!",
        "stat.change.fell": "[blue][[USER]][reset]'s [blue][[STAT]][reset] fell!",
        "stat.change.fell.harshly": "[blue][[USER]][red]'s [blue][[STAT]][red] fell harshly!",
        "stat.change.fell.severely": "[blue][[USER]][red]'s [blue][[STAT]][red] fell severely!",

        "status.poison.start": "[blue][[USER]][reset] has been poisoned!",
        "status.toxic.start": "[blue][[USER]][reset] has been badly poisoned!",

        "item.shield.boost": "[blue][[USER]][reset]'s Shield is now active",
        "item.shield.unboost": "[blue][[USER]][reset]'s Shield is no longer active",
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