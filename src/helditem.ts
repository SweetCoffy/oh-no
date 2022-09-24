import { Collection } from "discord.js";
import { Battle, calcDamage, Player } from "./battle.js";
import { getString, LocaleString } from "./locale.js";
import { StatID } from "./stats.js";
import { rng } from "./util.js"
export interface HeldItem {
    id: string,
    remove?: boolean,
    durability?: number,
}
type HeldItemCallback = (battle: Battle, player: Player, item: HeldItem) => any
function healEffect(percent: number, silent: boolean = false, message: LocaleString = "heal.generic"): HeldItemCallback {
    return function(b, p, it) {
        var amt = p.maxhp * percent
        b.heal(p, amt, silent, message)
    }
}
function everyXTurnsEffect(interval: number, effect: HeldItemCallback, elseEffect?: HeldItemCallback): HeldItemCallback {
    return function(b, p, it) {
        if (b.turn % interval == 0) {
            effect(b, p, it)
        } else {
            if (elseEffect) elseEffect(b, p, it)
        }
    }
}
function protectEffect(): HeldItemCallback {
    return function(b, p, it) {
        p.protect = true
    }
}
function chanceEffect(effect: HeldItemCallback, chance: number): HeldItemCallback {
    return function(b, p, it) {
        if (rng.get01() < chance) {
            effect(b, p, it)
        }
    }
}
function multiEffect(...effects: HeldItemCallback[]): HeldItemCallback {
    return function (b, p, it) {
        for (var e of effects) {
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
        b.log(getString(message, {player: p.name}))
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
export var items: Collection<string, HeldItemType> = new Collection()
items.set("eggs", 
    new HeldItemType("Eggs", (b, p, item) => {
        if (p.dead) return
        b.heal(p, Math.floor(p.maxhp / 16), false, "heal.eggs")
}, multiEffect(healEffect(1), statEffect("def", 1), statEffect("spdef", 1)))
.setEffect("Slowly regenerates the user's HP", "Fully heals the user and increases Defense and Special Defense").setIcon("🥚"))

items.set("shield", 
new HeldItemType("Shield", function(b, p, i) {
    var d = i as HeldItem & { used: boolean }
    if (!d.used) {
        p.addModifier("def", { value: 2, label: "Shield Item" })
        p.addModifier("spdef", { value: 2, label: "Shield Item" })
        p.addModifier("atk", { value: 0.25, label: "Shield Item" })
        p.addModifier("spatk", { value: 0.25, label: "Shield Item" })
        p.addModifier("spd", { value: 0.5, label: "Shield Item" })
        b.addAbsorption(p, p.maxhp / 3, 1)
        
        d.used = true;
    }
}, multiEffect(statEffect("def", 6), statEffect("spdef", 6))).setIcon("🛡️")
.setEffect("Increases Defense and Special Defense drastically and grants absorption, lowers Attack, Special Attack and Speed severely", "Sharply raises Defense and Special Defense and protects the user"))
items.set("category_swap",
new HeldItemType("Category Swap").setEffect("Swaps the category of all moves used").setIcon("🔄"))

items.set("bruh_orb",
new HeldItemType("Bruh Orb").setEffect("Increases all base stats, takes away all held items after a few turns").setIcon("🔴"))

items.set("bruh_orb_attack",
new HeldItemType("Bruh Orb (Attack)").setEffect("(Refer to base Bruh Orb) Increases Attack and Special attack more than other stats").setIcon("🗡️"))

items.set("bruh_orb_defense",
new HeldItemType("Bruh Orb (Defense)").setEffect("(Refer to base Bruh Orb) Increases Defense and Special Defense more than other stats").setIcon("🛡️"))

items.set("bruh_orb_hp",
new HeldItemType("Bruh Orb (HP)").setEffect("(Refer to base Bruh Orb) Increases HP more than other stats").setIcon("❤️"))

items.set("mirror", 
new HeldItemType("Mirror").setEffect("Reflects damage inflicted by other players. If it takes too much damage, it will shatter and make both the user and the attacker bleed").setIcon("🪞"))