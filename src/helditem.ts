import { Collection } from "discord.js";
import { Battle, calcDamage, Player } from "./battle.js";
import { getString, LocaleString } from "./locale.js";
import { StatID } from "./stats.js";
import { formatString, rng } from "./util.js"
import { DescriptionBuilder } from "./battle-description.js";
export interface HeldItem {
    id: string,
    remove?: boolean,
    durability?: number,
}
type HeldItemCallback = (battle: Battle, player: Player, item: HeldItem) => any
function healEffect(percent: number, silent: boolean = false, message: LocaleString = "heal.generic"): HeldItemCallback {
    return function (b, p, it) {
        let amt = p.maxhp * percent
        b.heal(p, amt, silent, message)
    }
}
function everyXTurnsEffect(interval: number, effect: HeldItemCallback, elseEffect?: HeldItemCallback): HeldItemCallback {
    return function (b, p, it) {
        if (b.turn % interval == 0) {
            effect(b, p, it)
        } else {
            if (elseEffect) elseEffect(b, p, it)
        }
    }
}
function protectEffect(): HeldItemCallback {
    return function (b, p, it) {
        p.protect = true
    }
}
function chanceEffect(effect: HeldItemCallback, chance: number): HeldItemCallback {
    return function (b, p, it) {
        if (rng.get01() < chance) {
            effect(b, p, it)
        }
    }
}
function multiEffect(...effects: HeldItemCallback[]): HeldItemCallback {
    return function (b, p, it) {
        for (let e of effects) {
            e(b, p, it)
        }
    }
}
function statEffect(stat: StatID, stages: number, silent = false): HeldItemCallback {
    return function (b, p, it) {
        b.statBoost(p, stat, stages, silent)
    }
}
function messageEffect(message: LocaleString): HeldItemCallback {
    return function (b, p, it) {
        b.log(getString(message, { player: p.toString() }))
    }
}
export class HeldItemType {
    name: string
    passiveEffect: string = "None"
    activeEffect: string = "None"
    removeUse: boolean = true
    onTurn?: HeldItemCallback
    onUse?: HeldItemCallback
    icon?: string
    constructor(name: string, onTurn?: HeldItemCallback, onUse?: HeldItemCallback) {
        this.name = name
        this.onTurn = onTurn
        this.onUse = onUse
    }
    setIcon(icon: string) {
        this.icon = icon;
        return this
    }
    setEffect(passive?: string, active?: string) {
        if (passive) this.passiveEffect = passive
        if (active) this.activeEffect = active
        return this
    }
    turn(p: Battle, player: Player, it: HeldItem) {
        if (this.onTurn) this.onTurn(p, player, it)
    }
    use(p: Battle, player: Player, it: HeldItem) {
        if (this.removeUse) it.remove = true
        if (this.onUse) this.onUse(p, player, it)
    }
}
export let items: Collection<string, HeldItemType> = new Collection()
items.set("eggs",
    new HeldItemType("Eggs", (b, p, item) => {
        if (p.dead) return
        b.heal(p, Math.floor(p.maxhp / 16), false, "heal.eggs")
    }, multiEffect(healEffect(1), statEffect("def", 1), statEffect("spdef", 1)))
        .setEffect(formatString("Every turn:\nHeals the user by [a]6.25%[r] of their [a]MAX HP[r].")).setIcon("🥚"))

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
    }, multiEffect(statEffect("def", 6), statEffect("spdef", 6))).setIcon("🛡️")
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
    new HeldItemType("Category Swap").setEffect("Swaps the damage category of all moves used").setIcon("🔄"))

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


items.set("bruh_orb",
    new HeldItemType("Bruh Orb").setEffect(DescriptionBuilder.new().line("At the start of battle, removes all held items and:")
        .mod(bruhOrbBoosts[""]).build()).setIcon("🔴"))

items.set("bruh_orb_attack",
    new HeldItemType("Bruh Orb (Attack)").setEffect(DescriptionBuilder.new().line("At the start of battle, removes all held items and:")
        .mod(bruhOrbBoosts.attack).build()).setIcon("🗡️"))

items.set("bruh_orb_speed",
    new HeldItemType("Bruh Orb (Speed)").setEffect(DescriptionBuilder.new().line("At the start of battle, removes all held items and:")
        .mod(bruhOrbBoosts.speed).build()).setIcon("👟"))

items.set("bruh_orb_defense",
    new HeldItemType("Bruh Orb (Defense)").setEffect(DescriptionBuilder.new().line("At the start of battle, removes all held items and:")
        .mod(bruhOrbBoosts.defense).build()).setIcon("🛡️"))

items.set("bruh_orb_hp",
    new HeldItemType("Bruh Orb (HP)").setEffect(DescriptionBuilder.new().line("At the start of battle, removes all held items and:")
        .mod(bruhOrbBoosts.hp).build()).setIcon("❤️"))

items.set("mirror",
    new HeldItemType("Mirror").setEffect(formatString("When the user is attacked:\nReflects [a]up to 25%[r] of damage taken, decreasing as [a]durability[r] is lost. The first hit taken triggers [a]Perfect Mirror[r], reflecting [a]100%[r] of the damage. Once shattered, the [a]user[r] [f]takes 12.5% damage[r], and both the [a]user[r] and the [a]attacker[r] are inflicted with [a]Bleed[r].")).setIcon("🪞"))