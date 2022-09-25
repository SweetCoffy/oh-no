import { Collection } from "discord.js";
import { Battle, Player, StatModifierID } from "./battle";

export class Ability {
    name: string
    cost: number
    damage(b: Battle, p: Player, dmg: number, inf?: Player) {
        this.onDamage?.(b, p, dmg, inf)
    }
    turn(b: Battle, p: Player) {
        this.onTurn?.(b, p)
    }
    onDamage?: (b: Battle, p: Player, dmg: number, inf?: Player) => number | undefined
    onTurn?: (b: Battle, p: Player) => any
    constructor(name: string, cost: number) {
        this.name = name;
        this.cost = cost;

    }
    static add(id: string, ability: Ability) {
        abilities.set(id, ability)
        return ability
    }
}

export const abilities: Collection<string, Ability> = new Collection();

Ability.add("hardening", new Ability("Bone Hardening", 300)).onTurn = function(b, p) {
    if (p.absorption < p.maxhp) b.addAbsorption(p, Math.ceil(p.maxhp / 10), 1)
}
Ability.add("massive_health_bar", new Ability("Massive Health Bar", 300)).onDamage = function (b, p, dmg, inf) {
    if (!p.abilityData.activated) {
        b.logL("ability.massive_health_bar", { name: p.toString() })
        //p.abilityData.activated = p.addModifier("hp", {
        //    type: "multiply",
        //    value: 2,
        //})
        p.abilityData.activated = true
        p.overheal++
        b.heal(p, p.maxhp, true, "heal.generic", true)
        return Math.min(p.hp + p.plotArmor + 1, dmg)
    }
    return undefined
}
var plot_armor = Ability.add("plot_armor", new Ability("Plot Armor", 200))
plot_armor.onTurn = function(b, p) {
    if (p.plotArmor < p.maxhp / 2) {
        p.plotArmor += Math.ceil(p.maxhp/24)
    }
}
var beserker_soul = Ability.add("beserker_soul", new Ability("Beserker Soul", 55))
beserker_soul.onTurn = function(b, p) {
    if (b.turn % 3 == 0) {
        b.takeDamage(p, p.maxhp/4)
        for (var player of b.players) {
            if (player != p) {
                b.takeDamageO(player, player.maxhp*0.03, { silent: true })
            }
        }
    }
}
var training_arc = Ability.add("training_arc", new Ability("Training Arc", -325))
training_arc.onTurn = function(b, p) {
    var data = p.abilityData as { modifiers?: StatModifierID[] }
    if (!data.modifiers) data.modifiers = [
        p.addModifier("hp", {
            label: "Training Arc Ability",
            value: 1,
        }),
        p.addModifier("atk", {
            label: "Training Arc Ability",
            value: 1,
        }),
        p.addModifier("def", {
            label: "Training Arc Ability",
            value: 1,
        }),
        p.addModifier("spatk", {
            label: "Training Arc Ability",
            value: 1,
        }),
        p.addModifier("spdef", {
            label: "Training Arc Ability",
            value: 1,
        }),
        p.addModifier("spd", {
            label: "Training Arc Ability",
            value: 1,
        })
    ]
    var v = 1 - Math.max((b.turn - 1) / 6 / 2, 0)
    if (v >= 0.5) {
        for (var mod of data.modifiers) {
            mod.value = v;
        }
    }
}