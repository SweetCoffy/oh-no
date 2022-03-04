import { Collection, User } from "discord.js"
import { getUser, PresetList } from "./users.js"
import { experimental } from "./util.js"

export interface Stats {
    [key: string]: number,
    /** Max HP */
    hp: number,
    /** Physical Attack, used when using a physical attacking move */
    atk: number,
    /** Physical Defense, used when taking damage from a physical attacking move */
    def: number,
    /** Special Attack, used when using a special attacking move */
    spatk: number,
    /** Special Defense, used when taking damage from a special attacking move */
    spdef: number,
    /** Speed, used for determining the order of actions with the same priority */
    spd: number,
}
export interface StatPreset {
    name: string,
    stats: Stats,
    helditems?: string[]
}
export const baseStats: Stats = {
    hp   :  100,
    atk  :  100,
    def  :  100,
    spatk:  100,
    spdef:  100,
    spd  :  100,
}
export var presets: Collection<string, StatPreset> = new Collection()
presets.set("default", {
    name: "Default",
    stats: {...baseStats},
    helditems: []
})
presets.set("apache", {
    name: "Apache Attack Helicopter",
    stats: {
        hp   :  104,
        atk  :  154,
        def  :   49,
        spatk:   99,
        spdef:   24,
        spd  :  170,
    },
    helditems: []
})
presets.set("tonk", {
    name: "Tonk",
    stats: {
        hp   : 117,
        atk  :  69,
        def  : 172,
        spatk:  83,
        spdef: 146,
        spd  :  13,
    },
    helditems: []
})
presets.set("extreme-apache", {
    name: "Extreme Apache Attack Helicopter",
    stats: {
        hp   :   37,
        atk  :  233,
        def  :   44,
        spatk:  110,
        spdef:   44,
        spd  :  132,
    },
    helditems: []
})
presets.set("extreme-tonk", {
    name: "Extreme Tonk",
    stats: {
        hp   :  76,
        atk  :  10,
        def  : 264,
        spatk:  32,
        spdef: 217,
        spd  :   1,
    },
    helditems: []
})
export function makeStats(obj?: {[key: string]: number}): Stats {
    var o: Stats = {
        hp: 0,
        atk: 0,
        def: 0,
        spatk: 0,
        spdef: 0,
        spd: 0,
    }
    if (obj) {
        for (var k in obj) {
            o[k] = obj[k]
        }
    }
    return o
}
// floor(0.01 x (2 x Base + IV + floor(0.25 x EV)) x Level) + Level + 10
// floor(0.01 x (2 x Base + IV + floor(0.25 x EV)) x Level) + 5)
export function calcStat(base: number, level: number, ev: number = 0) {
    if (experimental.ohyes_stat_formula) Math.floor((base / 1.5) + (base * (level / 9)))
    return Math.floor(0.01 * (2 * base + 31 + Math.floor(0.25 * ev)) * level) + 5
}
export function calcStats(level: number, baseStats: Stats, hpboost: number = 1): Stats {
    var s = makeStats()
    for (var k in baseStats) {
        s[k] = calcStat(baseStats[k], level, 0)
    }
    if (experimental.ohyes_stat_formula) {
        s.hp = Math.floor(s.hp*2.5 + baseStats.hp)
    } else {
        s.hp += (level + 5) * 1.1
        s.hp = Math.floor(s.hp * 1.7821676118462508 * hpboost)
    }
    return s
}
export function getPreset(name: string, user?: User) {
    if (user) {
        var u = getUser(user)
        if (u.presets[name]) return u.presets[name]
    }
    return presets.get(name)
}
export function getPresetList(user?: User) {
    var list: PresetList = {}
    if (user) {
        var u = getUser(user)
        list = {...list, ...u.presets}
    }
    for (var [k, v] of presets) {
        list[k] = v
    }
    return list
}