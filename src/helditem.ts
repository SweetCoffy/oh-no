import { Collection } from "discord.js";
import { Battle, calcMoveDamage, MoveCastOpts, Player, TakeDamageOptions } from "./battle.js";
import { getString, LocaleString } from "./locale.js";
import { StatID } from "./stats.js";
import { formatString, rng } from "./util.js"
import { DescriptionBuilder } from "./battle-description.js";
export interface HeldItem {
    id: string,
    remove?: boolean,
    durability?: number,
}
export type ItemClass = "bruh_orb" | "defense" | "offense" | "passive"
type HeldItemCallback = (battle: Battle, player: Player, item: HeldItem) => any
export class HeldItemType {
    name: string
    passiveEffect: string = "None"
    removeUse: boolean = true
    class: ItemClass = "passive"
    onTurn?: HeldItemCallback
    onBattleStart?: HeldItemCallback
    onDamage?: (battle: Battle, player: Player, item: HeldItem, dmg: number, opts: TakeDamageOptions) => number | void
    onDamageDealt?: (battle: Battle, player: Player, item: HeldItem, dmg: number, target: Player, opts: TakeDamageOptions) => number | void
    onMoveUse?: (battle: Battle, player: Player, item: HeldItem, move: string, opts: MoveCastOpts) => void
    icon?: string
    constructor(name: string, onTurn: typeof this.onTurn = undefined) {
        this.name = name
        this.onTurn = onTurn
    }
    setClass(c: ItemClass) {
        this.class = c
        return this
    }
    setIcon(icon: string) {
        this.icon = icon;
        return this
    }
    set(fn: ((v: typeof this) => void)) {
        fn(this)
        return this
    }
    setEffect(passive?: string) {
        if (passive) this.passiveEffect = passive
        return this
    }
    turn(p: Battle, player: Player, it: HeldItem) {
        if (this.onTurn) this.onTurn(p, player, it)
    }
}
export let items: Collection<string, HeldItemType> = new Collection()
items.set("eggs",
    new HeldItemType("Eggs", (b, p, item) => {
        if (p.dead) return
        b.heal(p, Math.floor(p.maxhp * 0.05), false, "heal.eggs")
    })
        .setEffect(formatString("Every turn:\nHeals the user by [a]5%[r] of their [a]MAX HP[r].")).setIcon("🥚"))

items.set("shield",
    new HeldItemType("Shield", function (b, p, i) {
        let d = i as HeldItem & { used: boolean }
        if (!d.used) {
            p.addModifier("def", { value: 1.3, label: "Shield" })
            p.addModifier("spdef", { value: 1.3, label: "Shield" })
            p.addModifier("atk", { value: 0.5, label: "Shield" })
            p.addModifier("spatk", { value: 0.5, label: "Shield" })
            p.addModifier("spd", { value: 0.8, label: "Shield" })
            b.addAbsorption(p, p.maxhp * 0.3, 2)

            d.used = true;
        }
    }).setIcon("🛡️")
        .setEffect(DescriptionBuilder.new()
            .line("At the start of battle, grants [a]Tier 2 Absorption[r] equivalent to [a]30%[r] to the user's [a]MAX HP[r], and:")
            .mod({
                def: 1.3,
                spdef: 1.3,
                atk: 0.5,
                spatk: 0.5,
                spd: 0.8,
            })
            .build()))
items.set("category_swap",
    new HeldItemType("Category Swap").setEffect("Swaps the damage category of all moves used").setClass("offense").set((v) => {
        v.onMoveUse = (_0, _1, _2, _3, opts) => {
            if (opts.category == "physical") {
                opts.category = "special"
            } else if (opts.category == "special") {
                opts.category = "physical"
            }
        }
    }).setIcon("🔄"))

export const bruhOrbBoosts: { [key: string]: { [x in StatID]?: number } } = {
    "": {
        hp: 1.025,
        atk: 1.05,
        def: 1.05,
        spatk: 1.05,
        spdef: 1.05,
        spd: 1.1,
    },
    "attack": {
        atk: 1.3,
        spatk: 1.3,
        spd: 1.05,
        def: 0.9,
        spdef: 0.9,
    },
    "speed": {
        atk: 1.025,
        spatk: 1.025,
        def: 0.95,
        spdef: 0.95,
        spd: 2,
    },
    "defense": {
        hp: 1.025,
        def: 1.3,
        spdef: 1.3,
        atk: 0.95,
        spatk: 0.95,
    },
    "hp": {
        hp: 1.2,
        def: 1.05,
        spdef: 1.05,
        atk: 0.9,
        spatk: 0.9,
    }
}

function bruhOrbEffect(boost: { [x in StatID]?: number }) {
    return function (b: Battle, p: Player, item: HeldItem) {
        for (let k in boost) {
            if (!boost[k as StatID]) continue
            p.addModifier(k as StatID, {
                value: boost[k as StatID] ?? 0,
                label: "Bruh Orb",
                type: "multiply",
                multCombine: "add"
            })
        }
    }
}

items.set("bruh_orb",
    new HeldItemType("Bruh Orb").set((v) => {
        v.onBattleStart = bruhOrbEffect(bruhOrbBoosts[""])
    }).setEffect(DescriptionBuilder.new()
        .mod(bruhOrbBoosts[""]).build()).setIcon("🔴").setClass("bruh_orb"))

items.set("bruh_orb_attack",
    new HeldItemType("Bruh Orb (Attack)").set((v) => {
        v.onBattleStart = bruhOrbEffect(bruhOrbBoosts.attack)
    }).setEffect(DescriptionBuilder.new()
        .mod(bruhOrbBoosts.attack).build()).setIcon("🗡️").setClass("bruh_orb"))

items.set("bruh_orb_speed",
    new HeldItemType("Bruh Orb (Speed)").set((v) => {
        v.onBattleStart = bruhOrbEffect(bruhOrbBoosts.speed)
    }).setEffect(DescriptionBuilder.new()
        .mod(bruhOrbBoosts.speed).build()).setIcon("👟").setClass("bruh_orb"))

items.set("bruh_orb_defense",
    new HeldItemType("Bruh Orb (Defense)").set((v) => {
        v.onBattleStart = bruhOrbEffect(bruhOrbBoosts.defense)
    }).setEffect(DescriptionBuilder.new()
        .mod(bruhOrbBoosts.defense).build()).setIcon("🛡️").setClass("bruh_orb"))

items.set("bruh_orb_hp",
    new HeldItemType("Bruh Orb (HP)").set((v) => {
        v.onBattleStart = bruhOrbEffect(bruhOrbBoosts.hp)
    }).setEffect(DescriptionBuilder.new()
        .mod(bruhOrbBoosts.hp).build()).setIcon("❤️").setClass("bruh_orb"))

items.set("mirror",
    new HeldItemType("Mirror").setEffect(
        formatString("When the user is attacked:\nReflects [a]up to 25%[r] of damage taken, decreasing as [a]durability[r] is lost. The first hit taken triggers [a]Perfect Mirror[r], reflecting [a]60%[r] of the damage. Once shattered, the [a]user[r] [f]takes 12.5% damage[r], and both the [a]user[r] and the [a]attacker[r] are inflicted with [a]Bleed[r]."))
        .setIcon("🪞")
        .setClass("defense"))