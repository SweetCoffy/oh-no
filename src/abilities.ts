import { Collection } from "discord.js";
import { Battle, isDamageDirect, Player, StatModifierWithID, TakeDamageOptions } from "./battle.js";
import { DescriptionBuilder } from "./battle-description.js";
import { lerp } from "./util.js";

export class Ability {
    name: string
    description: string
    // The ability's cost in base stat points, a negative cost increases the user's effective base stat total.
    cost: number
    damage(b: Battle, p: Player, dmg: number, inf?: Player, opts: TakeDamageOptions = {}) {
        return this.onDamage?.(b, p, dmg, inf, opts)
    }
    damageDealt(b: Battle, p: Player, dmg: number, victim: Player, opts: TakeDamageOptions = {}) {
        return this.onDamageDealt?.(b, p, dmg, victim, opts)
    }
    turn(b: Battle, p: Player) {
        this.onTurn?.(b, p)
    }
    damageTakenModifierOrder: number = 0
    damageDealtModifierOrder: number = 0
    onDamage?: (b: Battle, p: Player, dmg: number, inf: Player | undefined, opts: TakeDamageOptions) => number | void
    onDamageDealt?: (b: Battle, p: Player, dmg: number, victim: Player, opts: TakeDamageOptions) => number | void
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
        p.plotArmor += Math.ceil(p.maxhp * 0.05)
    }
}
plot_armor.description = DescriptionBuilder.new().line("Every turn:")
    .line("· The user [s]gains[r] [a]Plot Armor[r] equal to [a]5%[r] of their [a]MAX HP[r], until reaching [a]50%[r] of [a]MAX HP[r].")
    .line("· [a]Plot Armor[r] acts a buffer for the user's [a]HP[r], allowing it to go into the negatives before dying.")
    .line("· [a]Plot Armor[r] does not affect mechanics that scale with [a]MAX HP[r].")
    .build()

let beserker_soul = Ability.add("beserker_soul", new Ability("Beserker Soul", 120))
beserker_soul.onTurn = function (b, p) {
    if (p.abilityData?.type != "beserker_soul") {
        p.abilityData = {
            type: "beserker_soul",
            buffActive: false,
            atkMod: p.addModifier("atk", {
                label: "Beserker Soul",
                type: "multiply",
                value: 1,
            }),
            spatkMod: p.addModifier("spatk", {
                label: "Beserker Soul",
                type: "multiply",
                value: 1,
            }),
            defMod: p.addModifier("def", {
                label: "Beserker Soul",
                type: "multiply",
                value: 1,
            }),
            spdefMod: p.addModifier("spdef", {
                label: "Beserker Soul",
                type: "multiply",
                value: 1,
            })
        }
    }

    let atkMod = p.abilityData.atkMod
    let spatkMod = p.abilityData.spatkMod
    let defMod = p.abilityData.defMod
    let spdefMod = p.abilityData.spdefMod

    if (p.abilityData.buffActive) {
        p.magic = 9999
        p.charge = 9999
        return
    }

    let dmgTaken = Math.floor(p.maxhp * 0.25)
    let hpAfterDmg = p.hp - dmgTaken
    if (hpAfterDmg <= 0) {
        p.overheal += 4
        if (!p.abilityData.buffActive) {
            p.abilityData.buffActive = true
            atkMod.value = 1.5
            spatkMod.value = 1.5
            defMod.value = 10
            spdefMod.value = 10
            for (let mod of p.modifiers.hp) {
                mod.disabled = true
            }
            p.addModifier("hp", {
                label: "Beserker Soul",
                value: 0,
                type: "multiply",
            })
            b.logL("ability.beserker_soul", { player: p.toString() })
        }
        p.hp = p.maxhp * 5
        return
    }
    b.takeDamageO(p, dmgTaken, { inflictor: p, type: "ability" })
    let enemies = b.players.filter(other => b.isEnemy(p, other) && !p.dead)
    let dmgPerEnemy = Math.ceil(dmgTaken * 0.6 / enemies.length)
    for (let enemy of enemies) {
        b.takeDamageO(enemy, dmgPerEnemy)
    }
}
beserker_soul.onDamage = function (b, p, dmg, inf, opts) {
    if (opts.type == "ability") return
    if (!isDamageDirect(opts)) return 0
}
beserker_soul.description = DescriptionBuilder.new().line("Every turn:")
    .line("· The user [f]takes damage[r] equal to [a]25%[r] of their [a]MAX HP[r].")
    .line("· [a]60%[r] of the damage taken by the user is [a]distributed evenly[r] among all enemies still standing.")
    .line("· The user is [a]immune[r] to all indirect damage.")
    .line("If the damage taken from this ability would kill the user, their [a]MAX HP[r] is permanently reduced to [a]1[r], and:")
    .line("· The user gains [a]infinite[r] [f]Charge[r] and [a]Magic[r].")
    .line("· The user's [a]ATK[r] and [a]Special ATK[r] are [s]increased[r] by [a]50%[r].")
    .line("· The user's [a]DEF[r] and [a]Special DEF[r] are [s]increased[r] by [a]900%[r].")
    .build()
let training_arc = Ability.add("training_arc", new Ability("Training Arc", 300))
training_arc.onTurn = function (b, p) {
    let data = p.abilityData as { modifiers?: StatModifierWithID[] }
    let baseMult = 2.5
    if (!data.modifiers) data.modifiers = [
        p.addModifier("hp", {
            label: "Tracining Arc",
            value: baseMult,
        }),
        p.addModifier("atk", {
            label: "Training Arc",
            value: baseMult,
        }),
        p.addModifier("def", {
            label: "Training Arc",
            value: baseMult,
        }),
        p.addModifier("spatk", {
            label: "Training Arc",
            value: baseMult,
        }),
        p.addModifier("spdef", {
            label: "Training Arc",
            value: baseMult,
        }),
        p.addModifier("spd", {
            label: "Training Arc",
            value: baseMult,
        })
    ]
    let v = lerp(baseMult, 0.25, Math.min(Math.max((b.turn - 1) / 8, 0), 1))
    for (let mod of data.modifiers) {
        mod.value = v;
    }
    p.recalculateStats()
}
training_arc.description = DescriptionBuilder.new().line("At the start of battle:")
    .line("· [a]All stats[r] are [s]increased[r] by [a]150%[r]")
    .line("Every turn:")
    .line("· [a]All stats[r] [f]decrease[r] gradually, down to [a]25%[r] on turn [a]8[r]")
    .build()
let blood_is_fuel = Ability.add("blood_is_fuel", new Ability("Blood is Fuel", 0))
type UKAbilityData = {
    type: "uk"
    hardDamage: StatModifierWithID
}
function ukMaxHP(modid: string, p: Player) {
    return Math.max(p.getModifierValue(p.stats.hp, p.modifiers.hp, [modid]), 1)
}
blood_is_fuel.onTurn = (b, p) => {
    if (p.abilityData?.type != "uk") {
        let mod = p.addModifier("hp", {
            label: "Hard Damage (Blood is Fuel)",
            value: 0,
            type: "add",
        })
        p.abilityData = {
            type: "uk",
            hardDamage: mod
        }
    }
    let maxhp = ukMaxHP(p.abilityData.hardDamage.id, p)
    let data = p.abilityData as UKAbilityData
    if (data.hardDamage.value < 0) data.hardDamage.value += Math.ceil(maxhp / 10)
    if (data.hardDamage.value > 0) data.hardDamage.value = 0
    if (data.hardDamage.value < -maxhp + 1) data.hardDamage.value = -maxhp + 1
    p.recalculateStats()
}
blood_is_fuel.onDamageDealt = (b, p, dmg, _v) => {
    let s = p.status.findIndex(s => s.type == "bleed")
    if (s != -1) p.status.splice(s)
    b.heal(p, Math.ceil(dmg / 2), false, "heal.uk", false)
}
blood_is_fuel.onDamage = (b, p, dmg, inf, opts) => {
    if (!isDamageDirect(opts)) return
    let data = p.abilityData as UKAbilityData
    data.hardDamage.value -= Math.floor(dmg * 0.5)
    let maxhp = ukMaxHP(p.abilityData.hardDamage.id, p)
    if (data.hardDamage.value < -maxhp + 1) data.hardDamage.value = -maxhp + 1
    p.recalculateStats()
}
blood_is_fuel.description = DescriptionBuilder.new()
    .line("· When dealing damage, the user is [s]healed[r] by [a]50%[r] of the damage dealt. If the user is bleeding, the effect is removed before healing.")
    .line("· When taking [a]direct[r] damage, the user takes [a]Hard Damage[r] equal to [a]50%[r] of the damage taken.")
    .line("· [a]Hard Damage[r] temporarily [f]reduces[r] the user's [a]MAX HP[r].")
    .line("· [a]Hard Damage[r] is reduced by [a]10%[r] of [a]MAX HP[r] every turn.")
    .build()