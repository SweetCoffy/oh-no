import { Collection } from "discord.js";
import { Battle, Player } from "./battle";
import { getString, LocaleString } from "./locale.js";
import { rng } from "./util.js"
export interface HeldItem {
    id: string,
    remove?: boolean
}
type HeldItemCallback = (battle: Battle, player: Player, item: HeldItem) => any
function healEffect(percent: number, silent: boolean = false, message: LocaleString = "heal.generic"): HeldItemCallback {
    return function(b, p, it) {
        var amt = p.stats.hp * percent
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
    constructor(name: string, onTurn?: HeldItemCallback, onUse?: HeldItemCallback) {
        this.name = name
        this.onTurn = onTurn
        this.onUse = onUse
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
.setEffect("Heals the user by 5% of their max HP", "Fully heals the user and incrases Defense and Special Defense"))

items.set("shield", 
new HeldItemType("Shield", everyXTurnsEffect(2, 

    multiEffect(messageEffect("item.shield.unboost"), statEffect("def", -2, true), statEffect("spdef", -2, true),
    statEffect("atk", 1, true), statEffect("spatk", 1, true)),

    multiEffect(messageEffect("item.shield.boost"), statEffect("def", 2, true), statEffect("spdef", 2, true),
    statEffect("atk", -1, true), statEffect("spatk", -1, true))

    ), multiEffect(statEffect("def", 6), statEffect("spdef", 6)))
.setEffect("Every other turn, the users Defense and Special defense are increased, at the cost of Attack and Special", "Sharply raises Defense and Special Defense and protects the user"))
items.set("threat_orb", 
new HeldItemType("Threatening Orb", function(b, p, it) {
    if ((b.turn - 1) % 5 == 0) {
        b.log(`${p.name}'s Threatening Orb moment`, "red")
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
