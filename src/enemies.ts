import { Collection } from "discord.js";
import { BotAIType } from "./battle.js";
import { ItemStack } from "./items.js";
import { StatID, Stats } from "./stats.js";
import { BotAISettings } from "./battle-ai.js";
import { AbilityID, HeldItemID, ItemID, MoveID } from "./gen.js";

export type ItemDrop = ItemStack & { chance: number, item: ItemID }
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
    stats: Stats,
    boss: boolean,
    xpYield: number,
    the?: boolean,
    boost?: {[x in StatID]?: number},
    aiSettings?: BotAISettings
    encounter?: EncounterData,
    helditems?: HeldItemID[],
    ability?: AbilityID,
    drops?: ItemDrop[],
    moveset: MoveID[],
    id?: string
}

export let enemies: Collection<string, Enemy> = new Collection()
enemies.set("egg_hater", {
    name: "Egg Hater",
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
    moveset: ["bonk", "reckless_rush"],
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
    description: "What is even this thing",
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
    moveset: ["nerf_gun", "twitter", "mind_overwork"],
    aiSettings: {
        attackMult: 0.5
    },
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
    description: "Egg",
    stats: {
        hp: 10,
        atk  :    1,
        def  :    1,
        spatk:    1,
        spdef:    1,
        spd  :    1,
    },
    moveset: ["nerf_gun", "twitter", "mind_overwork", "heal"],
    aiSettings: {
        supportMult: 2.0,
        selfSupportMult: 0.5,
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
    description: "sus",
    stats: {
        hp   :    50,
        atk  :    250,
        def  :    350,
        spatk:    75,
        spdef:    350,
        spd  :    25,
    },
    moveset: ["bonk", "slap", "reckless_rush"],
    aiSettings: {
        selfSupportMult: 1.5,
        supportMult: 0.0,
    },
    encounter: {
        minPlayerLevel: 25,
        maxPlayerLevel: Infinity,
        rate: 5,
        minLevel: 1,
        maxLevel: 1.1,
        relativeLevel: true,
    },
    boss: true,
    xpYield: 2000,
})
enemies.set("egg_lord", {
    name: "Egg Lord",
    description: "Spooky egg",
    stats: {
        hp   :  122,
        atk  :    0,
        def  :  148,
        spatk:  195,
        spdef:  148,
        spd  :   83,
    },
    moveset: ["nerf_gun", "twitter", "mind_overwork"],
    boss: true,
    the: true,
    xpYield: 300,
})
enemies.set("the_cat", {
    name: "The Cat",
    description: "Please do not the cat",
    stats: {
        hp   :  100,
        atk  :  256,
        def  :   69,
        spatk:    0,
        spdef:   69,
        spd  :  256,
    },
    moveset: ["slap", "reckless_rush", "bonk"],
    aiSettings: {
        attackMult: 2.0
    },
    boss: true,
    the: true,
    xpYield: 6969,
})
enemies.set("u", {
    name: "ú",
    description: "Literal god",
    stats: {
        hp   :  210,
        atk  :  225,
        def  :  110,
        spatk:    1,
        spdef:   99,
        spd  :  232,
    },
    moveset: ["slap", "reckless_rush", "bonk", "pingcheck"],
    aiSettings: {
        attackMult: 2.0
    },
    boss: true,
    xpYield: 10000,
    helditems: [],
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 1.0,
        maxLevel: 1.2,
    }
})
enemies.set("o", {
    name: "ö",
    description: [..."Literal god"].reverse().join(""),
    stats: {
        hp   :  364,
        atk  :   71,
        def  :  159,
        spatk:   71,
        spdef:  201,
        spd  :    0,
    },
    moveset: ["mind_overwork", "nerf_gun", "twitter", "heal"],
    aiSettings: {
        selfSupportMult: 1.2,
        supportMult: 1.5,
        attackMult: 0.9,
    },
    boss: true,
    xpYield: 10000,
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 1.0,
        maxLevel: 1.2,
    }
})
enemies.set("y", {
    name: "ÿ",
    description: "Actual god",
    stats: {
        hp   :  364,
        atk  :  637,
        def  :  159,
        spatk:  316,
        spdef:  201,
        spd  :  232,
    },
    moveset: ["reckless_rush", "bonk", "nerf_gun", "twitter"],
    aiSettings: {
        attackMult: 2.0
    },
    boss: true,
    xpYield: 10000,
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 1.0,
        maxLevel: 1.2,
    }
})
enemies.set("sun", {
    name: "The Sun",
    description: "The Sun looking fire",
    stats: {
        hp: 1300,
        atk: 25,
        def: 1,
        spatk: 25,
        spdef: 1,
        spd: 25,
    },
    boss: true,
    xpYield: 100000,
    ability: "plot_armor",
    moveset: ["twitter", "regen", "counter", "protect", "release"],
    aiSettings: {
        supportMult: 2.0,
        selfSupportMult: 1.2,
    },
    encounter: {
        rate: 1,
        relativeLevel: true,
        minPlayerLevel: 30,
        maxPlayerLevel: Infinity,
        minLevel: 1.0,
        maxLevel: 1.2,
    }
})
for (let [k, v] of enemies) {
    v.id = k
}