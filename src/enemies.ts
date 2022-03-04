import { Collection } from "discord.js";
import { BotAIType } from "./battle.js";
import { ItemStack } from "./items.js";
import { Stats } from "./stats.js";

export type ItemDrop = ItemStack & { chance: number }
export interface EncounterData {
    minPlayerLevel: number,
    maxPlayerLevel: number,
    rate: number,
    minLevel: number,
    maxLevel: number,
    relativeLevel?: boolean,
}
export interface Enemy {
    name: string,
    description?: string,
    ai: BotAIType,
    stats: Stats,
    boss: boolean,
    xpYield: number,
    the?: boolean,
    boost?: Stats,
    encounter?: EncounterData,
    helditems?: string[],
    drops?: ItemDrop[],
}

export var enemies: Collection<string, Enemy> = new Collection()
enemies.set("egg_hater", {
    name: "Egg Hater",
    ai: "normal",
    description: "An egg hater, these guys are pretty dumb lmao",
    stats: {
        hp: 100,
        atk: 151,
        def: 50,
        spatk: 0,
        spdef: 50,
        spd: 100,
    },
    boss: false,
    xpYield: 100,
    encounter: {
        minPlayerLevel: 0,
        maxPlayerLevel: Infinity,
        rate: 100,
        minLevel: 0.5,
        maxLevel: 0.75,
        relativeLevel: true,
    }
})
enemies.set("otsid", {
    name: "Otsid",
    ai: "egg_lord",
    description: "This thing has a lot of HP and decent defense so prepare to fight this thing for a while...",
    stats: {
        hp: 420,
        atk: 0,
        def: 100,
        spatk: 30,
        spdef: 100,
        spd: 0,
    },
    boss: false,
    xpYield: 250,
    encounter: {
        minPlayerLevel: 10,
        maxPlayerLevel: Infinity,
        rate: 50,
        minLevel: 0.75,
        maxLevel: 1.1,
        relativeLevel: true,
    }
})
enemies.set("egg", {
    name: "Egg",
    ai: "the_cat",
    description: "Egg",
    stats: {
        hp   :    1,
        atk  :    1,
        def  :    1,
        spatk:    1,
        spdef:    1,
        spd  :    1,
    },
    encounter: {
        minPlayerLevel: 10,
        maxPlayerLevel: Infinity,
        rate: 25,
        minLevel: 1,
        maxLevel: 2,
        relativeLevel: true,
    },
    boss: false,
    xpYield: 1000,
})
enemies.set("the_skeleton", {
    name: "The Skeleton",
    ai: "normal",
    description: "sus",
    stats: {
        hp   :    50,
        atk  :    250,
        def  :    350,
        spatk:    75,
        spdef:    350,
        spd  :    25,
    },
    encounter: {
        minPlayerLevel: 25,
        maxPlayerLevel: Infinity,
        rate: 5,
        minLevel: 1,
        maxLevel: 1.1,
        relativeLevel: true,
    },
    boost: {
        hp: 0,
        atk: 6,
        def: 6,
        spatk: 0,
        spdef: 0,
        spd: 0,
    },
    boss: true,
    xpYield: 2000,
})
enemies.set("egg_lord", {
    name: "Egg Lord",
    ai: "egg_lord",
    description: "It's the Egg Lord. Unlike eggs, it actually takes hit pretty well",
    stats: {
        hp   :  122,
        atk  :    0,
        def  :  148,
        spatk:  195,
        spdef:  148,
        spd  :   83,
    },
    boost: {
        hp: 0,
        atk: 0,
        def: 2,
        spatk: 0,
        spdef: 2,
        spd: 0,
    },
    boss: true,
    the: true,
    xpYield: 300,
})
enemies.set("the_cat", {
    name: "The Cat",
    ai: "the_cat",
    description: "An angry cat. It's pretty aggressive and hits really hard",
    stats: {
        hp   :  100,
        atk  :  256,
        def  :   69,
        spatk:    0,
        spdef:   69,
        spd  :  256,
    },
    boost: {
        hp: 0,
        atk: 0,
        def: 1,
        spatk: 0,
        spdef: 1,
        spd: 0,
    },
    boss: true,
    the: true,
    xpYield: 6969,
})
enemies.set("u", {
    name: "ú",
    ai: "u",
    description: "Literal god",
    stats: {
        hp   :  210,
        atk  :  225,
        def  :  110,
        spatk:    1,
        spdef:   99,
        spd  :  232,
    },
    boost: {
        hp: 0,
        atk: 3,
        def: 3,
        spatk: 3,
        spdef: 3,
        spd: 3,
    },
    boss: true,
    xpYield: 10000,
    helditems: ["threat_orb", ],
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 3,
        maxLevel: 5,
    }
})
enemies.set("o", {
    name: "ö",
    ai: 'egg_lord',
    description: [..."Literal God"].reverse().join(""),
    stats: {
        hp   :  364,
        atk  :   71,
        def  :  159,
        spatk:   71,
        spdef:  201,
        spd  :    0,
    },
    boost: {
        hp: 0,
        atk: 3,
        def: 3,
        spatk: 3,
        spdef: 3,
        spd: 3,
    },
    boss: true,
    xpYield: 10000,
    helditems: ["eggs", "shield"],
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 3,
        maxLevel: 5,
    }
})
enemies.set("y", {
    name: "ÿ",
    ai: "u",
    description: "Actual god",
    stats: {
        hp   :  364,
        atk  :  637,
        def  :  159,
        spatk:  316,
        spdef:  201,
        spd  :  232,
    },
    boost: {
        hp: 0,
        atk: 3,
        def: 3,
        spatk: 3,
        spdef: 3,
        spd: 3,
    },
    boss: true,
    xpYield: 10000,
    helditems: ["eggs", "shield"],
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 3,
        maxLevel: 5,
    }
})