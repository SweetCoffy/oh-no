import { Collection } from "discord.js";
import { Battle, Player, StatModifierID } from "./battle.js";
import { DescriptionBuilder } from "./battle-description.js";

export class Ability {
    name: string
    description: string
    // The ability's cost in base stat points, a negative cost increases the user's effective base stat total.
    cost: number
    damage(b: Battle, p: Player, dmg: number, inf?: Player) {
        this.onDamage?.(b, p, dmg, inf)
    }
    damageDealt(b: Battle, p: Player, dmg: number, victim: Player) {
        this.onDamageDealt?.(b, p, dmg, victim)
    }
    turn(b: Battle, p: Player) {
        this.onTurn?.(b, p)
    }
    onDamage?: (b: Battle, p: Player, dmg: number, inf?: Player) => number | void
    onDamageDealt?: (b: Battle, p: Player, dmg: number, victim: Player) => number | void
    onTurn?: (b: Battle, p: Player) => any
    constructor(name: string, cost: number, description: string = "N/A") {
        this.name = name;
        this.cost = cost;
        this.description = description
    }
    static add(id: string, ability: Ability) {
        abilities.set(id, ability)
        return ability
    }
}

export const abilities: Collection<string, Ability> = new Collection();

let hardening = Ability.add("hardening", new Ability("Bone Hardening", 300))
hardening.onTurn = function (b, p) {
    if (p.absorption < p.maxhp) b.addAbsorption(p, Math.ceil(p.maxhp / 10), 1)
}
hardening.description = DescriptionBuilder.new().line("Every turn, if [a]Absorption[r] is lower than the user's [a]MAX HP[r]:")
    .line("· The user [s]gains[r] Tier 1 [a]Absorption[r] equal to [a]10%[r] of their [a]MAX HP[r]")
    .build()
let massive_health_bar = Ability.add("massive_health_bar", new Ability("Massive Health Bar", 300))
massive_health_bar.onDamage = function (b, p, dmg, inf) {
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
massive_health_bar.description = DescriptionBuilder.new().line("When damage is taken:")
    .line("· The user [s]gains[r] [a]1[r]× Overheal[r]")
    .line("· The user is [s]healed[r] by [a]100%[r] of their [a]MAX HP[r]")
    .line("· [a]This effect can only be triggered once.[r]")
    .build()

let plot_armor = Ability.add("plot_armor", new Ability("Plot Armor", 200))
plot_armor.onTurn = function (b, p) {
    if (p.plotArmor < p.maxhp / 2) {
        p.plotArmor += Math.ceil(p.maxhp / 24)
    }
}
plot_armor.description = DescriptionBuilder.new().line("Every turn:")
    .line("· The user [s]gains[r] [a]Plot Armor[r] equal to [a]4.16%[r] of their [a]MAX HP[r], until reaching [a]50%[r] of [a]MAX HP[r].")
    .line("· [a]Plot Armor[r] allows the user's [a]HP[r] to go a [a]certain amount[r] below [a]0[r] before [f]dying[r].")
    .build()

let beserker_soul = Ability.add("beserker_soul", new Ability("Beserker Soul", 55))
beserker_soul.onTurn = function (b, p) {
    if (b.turn % 3 == 0) {
        b.takeDamage(p, p.maxhp / 4)
        for (let player of b.players) {
            if (player != p) {
                b.takeDamageO(player, player.maxhp * 0.03, { silent: true })
            }
        }
    }
}
beserker_soul.description = DescriptionBuilder.new().line("Every [a]3[r] turns:")
    .line("· The user [f]takes damage[r] equal to [a]25%[r] of their [a]MAX HP[r].")
    .line("· All other battlers [f]take damage[r] equal to [a]3%[r] of their [a]MAX HP[r].")
    .build()
let training_arc = Ability.add("training_arc", new Ability("Training Arc", -325))
training_arc.onTurn = function (b, p) {
    let data = p.abilityData as { modifiers?: StatModifierID[] }
    if (!data.modifiers) data.modifiers = [
        p.addModifier("hp", {
            label: "Training Arc",
            value: 1,
        }),
        p.addModifier("atk", {
            label: "Training Arc",
            value: 1,
        }),
        p.addModifier("def", {
            label: "Training Arc",
            value: 1,
        }),
        p.addModifier("spatk", {
            label: "Training Arc",
            value: 1,
        }),
        p.addModifier("spdef", {
            label: "Training Arc",
            value: 1,
        }),
        p.addModifier("spd", {
            label: "Training Arc",
            value: 1,
        })
    ]
    let v = 1 - Math.min((b.turn - 1) / 6 * 0.5, 0.5)
    for (let mod of data.modifiers) {
        mod.value = v;
    }
}
training_arc.description = DescriptionBuilder.new().line("This ability increases the user's usable base stat total by [a]325[r], however:")
    .line("· [a]All stats[r] [f]decrease[r] each turn, until reaching [a]50%[r] on turn [a]6[r]")
    .build()
let blood_is_fuel = Ability.add("blood_is_fuel", new Ability("Blood is Fuel", 0))
type UKAbilityData = {
    type: "uk"
    hardDamage: StatModifierID
}
blood_is_fuel.onTurn = (b, p) => {
    if (p.abilityData?.type != "uk") {
        let mod = p.addModifier("hp", {
            label: "Hard Damage (Blood is Fuel)",
            value: 1,
            type: "multiply",
        })
        p.abilityData = {
            type: "uk",
            hardDamage: mod
        }
    }
    let data = p.abilityData as UKAbilityData
    if (data.hardDamage.value < 1) data.hardDamage.value += 1 / 10
    if (data.hardDamage.value > 1) data.hardDamage.value = 1
}
blood_is_fuel.onDamageDealt = (b, p, dmg) => {
    //let data = p.abilityData as UKAbilityData
    let s = p.status.findIndex(s => s.type == "bleed")
    if (s != -1) p.status.splice(s)
    b.heal(p, Math.ceil(dmg / 2), false, "heal.uk", false)
}
blood_is_fuel.onDamage = (b, p, dmg) => {
    let data = p.abilityData as UKAbilityData
    data.hardDamage.value -= dmg / p.stats.hp * 0.75
    if (data.hardDamage.value < 0) data.hardDamage.value = 0
}
blood_is_fuel.description = DescriptionBuilder.new()
    .line("When damage is dealt:")
    .line("· The [a]Bleed[r] effect is removed, if present.")
    .line("· The user is [s]healed[r] by [a]50%[r] of the damage dealt.")
    .line("When damage is taken:")
    .line("· [f]Decreases[r] [a]MAX HP[r] by [a]75% of the damage taken[r], proportional to the user's [a]unmodified MAX HP[r].")
    .line("Every turn:")
    .line("· Hard Damage is decreased by [a]10%[r], until [a]MAX HP[r] is fully restored.")
    .build()