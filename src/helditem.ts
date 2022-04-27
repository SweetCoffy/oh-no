import { Collection } from "discord.js";
import { Battle, calcDamage, Player } from "./battle.js";
import { getString, LocaleString } from "./locale.js";
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
function statEffect(stat: string, stages: number, silent = false): HeldItemCallback {
    return function (b, p, it) {
        b.statBoost(p, stat, stages, silent)
    }
}
function messageEffect(message: LocaleString): HeldItemCallback {
    return function (b, p, it) {
        b.log(getString(message, {USER: p.name}))
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
new HeldItemType("Eggs", healEffect(0.05), multiEffect(healEffect(1), statEffect("def", 1), statEffect("spdef", 1)))
.setEffect("Heals the user by 5% of their max HP", "Fully heals the user and increases Defense and Special Defense").setIcon("<:EggItem:943340432690118698>"))

items.set("shield", 
new HeldItemType("Shield", function(b, p, i) {
    var d = i as HeldItem & { used: boolean }
    if (!d.used) {
        p.addModifier("def", { value: 4, label: "Shield Item" })
        p.addModifier("spdef", { value: 4, label: "Shield Item" })
        p.addModifier("atk", { value: 0.25, label: "Shield Item" })
        p.addModifier("spatk", { value: 0.25, label: "Shield Item" })
        p.addModifier("spd", { value: 0.25, label: "Shield Item" })
        p.absorption += p.maxhp / 4;
        p.absorptionTier = 3;
        
        d.used = true;
    }
}, multiEffect(statEffect("def", 6), statEffect("spdef", 6)))
.setEffect("Increases Defense and Special Defense drastically and grants 25% T2 absorption, lowers Attack, Special Attack and Speed severely", "Sharply raises Defense and Special Defense and protects the user"))
items.set("threat_orb", 
new HeldItemType("Threatening Orb", function(b, p, it) {
    if ((b.turn - 1) % 5 == 0) {
        b.log(`${p.name}'s Threatening Orb moment`, "red")
        if (b.type == "pve") return b.log(`It had no effect!`)
        for (var player of b.players) {
            if (player != p) {
                b.statBoost(player, "atk", -1)
                b.statBoost(player, "spatk", -1)
            }
        }
    }
}, function(b, p, it) {
    b.log(`${p.name}'s Threatening Orb moment`, "red")
    for (var player of b.players) {
        if (player != p) {
            b.statBoost(player, "atk", -6 - player.statStages.atk)
            b.statBoost(player, "spatk", -6 - player.statStages.spatk)
        }
    }
}).setEffect("Every 3 turns, everyone else's Attack and Special Attack stats will be lowered", "Everyone else's Attack and Special Attack is lowered to oblivion")
)
items.set("category_swap",
new HeldItemType("Category Swap").setEffect("Swaps the category of all moves used"))

items.set("bruh_orb",
new HeldItemType("Bruh Orb").setEffect("ae").setIcon("<:BruhOrb:943339300056072212>"))

items.set("bruh_orb_attack",
new HeldItemType("Bruh Orb (Attack)").setEffect("ae").setIcon("<:BruhOrbAttack:943339299598893057>"))

items.set("bruh_orb_defense",
new HeldItemType("Bruh Orb (Defense)").setEffect("ae").setIcon("<:BruhOrbDefense:943339299892514867>"))

items.set("bruh_orb_hp",
new HeldItemType("Bruh Orb (HP)").setEffect("ae").setIcon("<:BruhOrbHP:943339299661807637>"))

items.set("mirror", 
new HeldItemType("Mirror").setEffect("Reflects damage inflicted by other players, will break if it takes too much damage"))