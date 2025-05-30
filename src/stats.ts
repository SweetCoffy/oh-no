import { Collection, User } from "discord.js"
import { getUser, PresetList } from "./users.js"
import { weightedDistribution } from "./util.js"
export type StatID = "hp" | "atk" | "def" | "spatk" | "spdef" | "spd"
export type ExtendedStatID = StatID | "chglimit" | "maglimit" | "chgbuildup" | "magbuildup" | "dr" | "crit" | "critdmg"
export type Stats = {
    [x in StatID]: number
}
export type ExtendedStats = {
    [x in ExtendedStatID]: number
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
export let presets: Collection<string, StatPreset> = new Collection()
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
presets.set("rock", {
    name: "Rock",
    stats: {
        hp   :   0,
        atk  :   0,
        def  : 300,
        spatk:   0,
        spdef: 300,
        spd  :   0,
    },
    helditems: [],
    ability: "hardening",
})
export function makeStats(obj?: {[key: string]: number}): Stats {
    let o: Stats = {
        hp: 0,
        atk: 0,
        def: 0,
        spatk: 0,
        spdef: 0,
        spd: 0,
    }
    if (obj) {
        for (let k in obj) {
            o[k as StatID] = obj[k]
        }
    }
    return o
}
export function makeExtendedStats(obj?: { [key: string]: number }): ExtendedStats {
    let o: ExtendedStats = {
        hp: 0,
        atk: 0,
        def: 0,
        spatk: 0,
        spdef: 0,
        spd: 0,
        chglimit: 0,
        maglimit: 0,
        chgbuildup: 0,
        magbuildup: 0,
        dr: 0,
        crit: 0,
        critdmg: 0,
    }
    if (obj) {
        for (let k in obj) {
            o[k as StatID] = obj[k]
        }
    }
    return o
}
export function calcStat(base: number, level: number) {
    let v = Math.ceil(50 + level * base * 0.25)
    return v
}
export function calcStats(level: number, baseStats: Stats): Stats {
    let s = makeStats()
    for (let k in baseStats) {
        s[k as StatID] = calcStat(baseStats[k as StatID], level)
    }
    s.hp += level*50 + Math.ceil(s.hp * 0.5)
    return s
}
export function getPreset(name: string, user?: User) {
    if (user) {
        let u = getUser(user)
        if (u.presets[name]) return u.presets[name]
    }
    return presets.get(name)
}


const BST_MIN_LIMIT = 0.05
const BST_MAX_LIMIT = 0.6

export function limitStats(stats: Stats, bst: number): Stats {
    let newValues = weightedDistribution(Object.values(stats), bst)
    let keys: StatID[] = Object.keys(stats) as StatID[]
    let max = bst * BST_MAX_LIMIT
    let min = bst * BST_MIN_LIMIT
    let curTotal = 0
    let newStats = { ...stats }
    for (let i in newValues) {
        let v = newValues[i]
        newValues[i] = Math.max(Math.min(v, max), min)
        curTotal += newValues[i]
        newStats[keys[i]] = newValues[i]
    }
    newValues = weightedDistribution(Object.values(newStats), bst)
    keys = Object.keys(newStats) as StatID[]
    //@ts-ignore
    newStats = Object.fromEntries(newValues.map((v, i) => [keys[i], v]))
    curTotal = 0
    for (let k in newStats) {
        //@ts-ignore
        newStats[k] = Math.floor(newStats[k])
        //@ts-ignore
        curTotal += newStats[k]
    }
    let needed = bst - curTotal
    let perStat = Math.ceil(needed / newValues.length)
    for (let k in newStats) {
        if (needed <= 0) {
            break
        }
        //@ts-ignore
        newStats[k] += perStat
        needed -= perStat
    }
    return newStats
}
export function getPresetList(user?: User) {
    let list: PresetList = {}
    if (user) {
        let u = getUser(user)
        list = {...list, ...u.presets}
    }
    for (let [k, v] of presets) {
        list[k] = v
    }
    return list
}