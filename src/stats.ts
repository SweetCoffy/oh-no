import { Collection, User } from "discord.js"
import { LOWER_FACTOR, STAT_MUL } from "./params.js"
import { getUser, PresetList } from "./users.js"
import { experimental } from "./util.js"
export type StatID = "hp" | "atk" | "def" | "spatk" | "spdef" | "spd"
export type Stats = {
    [x in StatID]: number
}
export interface StatPreset {
    name: string,
    stats: Stats,
    helditems?: string[],
    ability?: string,
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
    helditems: [],
    ability: "hardening",
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
            o[k as StatID] = obj[k]
        }
    }
    return o
}
export function calcStat(base: number, level: number, ev: number = 0) {
    let v = Math.floor( 
        ((base / 1.5) + (base/5 * level/9) + (level * base/32) + level*7.5) * (1 + level/LOWER_FACTOR) * STAT_MUL)
    return v
}
export function calcStats(level: number, baseStats: Stats, hpboost: number = 1): Stats {
    var s = makeStats()
    for (var k in baseStats) {
        s[k as StatID] = calcStat(baseStats[k as StatID], level, 0)
    }
    s.hp = Math.floor(s.hp*2.5*hpboost)
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