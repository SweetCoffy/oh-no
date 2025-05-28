import { Collection } from "discord.js"
import { Battle, calcDamage, Player } from "./battle.js"
import { makeStats, Stats } from "./stats.js"
import { formatString, weightedDistribution } from "./util.js"

export type MoveType = "attack" | "status" | "protect" | "heal" | "absorption" | "noop"
export type Category = "physical" | "special" | "status"
export type DamageType = "regular" | "set" | "percent"
export interface InflictStatus {
    status: string,
    chance: number,
}
export class Move {
    requiresCharge: number = 0
    requiresMagic: number = 0
    name: string
    /**
     * The damage calculation type
     * 
     * `regular` Damage is equal to `power` times the user's appropiate ATK stat times the `MOVE_POWER_ATK_MULT` constant
     * 
     * `set` Damage is equal to `power`
     * 
     * `percent` Damage is equal `power` % of the target's max HP
     */
    setDamage: DamageType = "regular"
    /**
     * The critical hit chance multiplier
     */
    critMul: number = 1
    /**
     * The damage category of the move, determines which stats will be used in the damage calculations
     * 
     * `physical` Uses the user's Attack stat and the target's Defense stat
     * 
     * `special` Uses the user's Special Attack stat and the target's Special Defense stat
     * 
     * `status` For moves that don't deal damage or ignore DEF stats.
     */
    category: Category = "physical"
    /**
     * for move type `attack`: Determines how much damage the move does
     * 
     * for move type `heal`: Determines the health % to heal
     * 
     * for move type `absorption`: Determines the health % absorption gained
     */
    power: number | null = null
    accuracy: number = 100
    /**
     * The type of the move
     * 
     * `attack` An attacking move, goes through regular damage calculations
     * 
     * `status` A move that only inflicts a status condition or changes stats
     * 
     * `protect` Sets the user's protect flag and increments their protect turns counter
     * 
     * `heal` Heals the user by the move's power %
     * 
     * `absorption` Increases the user's absorption by power %
     */
    type: MoveType = "attack"
    /**
     * Whether or not to allow overhealing when `type` is set to `heal`
     */
    overheal: boolean = false
    /**
     * The tier of absorption to use when `type` is set to `absorption`
     */
    absorptionTier: number = 1
    /**
     * The priority of the move when added to the action list
     * 
     * Actions with higher priority will be done before actions with lower priority regardless of speed
     */
    priority: number = 0
    /**
     * The health % of recoil the move has
     */
    recoil: number = 0
    /**
     * The chance of the user stat changes to be applied
     */
    userStatChance: number = 1
    userStat: Stats = makeStats()
    /**
     * The chance of the target stat changes to be applied
     */
    targetStatChance: number = 1
    targetStat: Stats = makeStats()
    /**
     * Whether or not the move can break through Protect, only 25% of the damage will be done
     */
    breakshield = false
    /**
     * A list of status conditions to inflict, each can have their own chance
     */
    inflictStatus: InflictStatus[] = []
    description: string
    /**
     * Whether or not this move can be selected by players
     */
    selectable: boolean = true
    /**
     * Whether or not to continue the move instead of failing, used for moves like Counter and Protect is Cringe
     * @param b The battle
     * @param user The move's user
     * @param target The move's target
     * @returns Whether or not the move should continue
     */
    checkFail(b: Battle, user: Player, target: Player) {
        return true
    }
    /**
     * Calculates the move's power, used for moves with variable power like Counter
     * @param b The battle
     * @param user The move's user
     * @param target The move's target
     * @returns The move's power
     */
    getPower(b: Battle, user: Player, target: Player) {
        return this.power || 0
    }
    /**
     * Function to run when the move is used. If present, it will override default behaviour
     */
    onUse?: (b: Battle, user: Player, target: Player) => void
    /**
     * Whether or not this move hits all enemies in PvE mode. Currently not implemented and probably getting removed
     */
    hitAll: boolean = false
    targetSelf: boolean = false
    constructor(name: string, type: MoveType = "attack", power: number, category: Category = "physical", accuracy: number = 100) {
        this.type = type
        this.power = power
        this.accuracy = accuracy
        this.name = name
        this.category = category
        this.description = `${name} ${category} ${type} ${power}`
    }
    set(func: (move: Move) => any) {
        func(this)
        return this
    }
    setDesc(description: string) {
        this.description = description
        return this
    }
}
export let moves: Collection<string, Move> = new Collection()

// Physical/Special basic attacks
moves.set("bonk", new Move("Bonk", "attack", 180))
moves.set("needle", new Move("Needle", "attack", 100/20, "physical", 80).set(move => {
    move.inflictStatus.push({ status: "bleed", chance: 1 })
    move.setDamage = "percent"
}).setDesc(formatString("Deals fixed damage equal to [a]5%[r] of the target's [a]MAX HP[r] and inflicts them with [a]Bleed[r]")))
moves.set("nerf_gun", new Move("Nerf Gun", "attack", 180, "special"))

// Physical/Special recoil attacks
moves.set("ping", new Move("Ping Attack", "attack", 375, "special").set(move => {
    move.requiresMagic = 30
}).setDesc(formatString("A strong [a]Special[r] move that requires [a]Magic[r] to use.")))
moves.set("slap", new Move("Slap", "attack", 375).set(move => {
    move.requiresCharge = 15
}).setDesc(formatString("A strong [a]Physical[r] move that requires [a]Charge[r] to use.")))

// Status inflicting moves
moves.set("twitter", new Move("Twitter", "status", 0, "status", 90).set(move => {
    move.inflictStatus.push({chance: 1, status: "poison"})
    move.userStat.def = -1
    move.userStat.spdef = -1
}).setDesc(formatString("Inflicts the target with [a]Poison[r]")))

// Physical stat boosting moves
moves.set("stronk", new Move("Stronk", "status", 0, "status").set(move => {
    move.targetStat.atk = 1
    move.targetSelf = true
}).setDesc(formatString("Increases the user's [a]ATK[r] by [a]1[r] stage.")))

moves.set("tonk", new Move("Tonk", "status", 0, "status").set(move => {
    move.targetStat.def = 1
    move.targetSelf = true
}).setDesc(formatString("Increases the user's [a]DEF[r] by [a]1[r] stage.")))

moves.set("reckless_rush", new Move("Reckless Rush", "status", 0, "status").set(move => {
    move.targetSelf = true
    move.requiresCharge = 20
    move.onUse = (b, p) => {
        let s = b.inflictStatus(p, "rush")
        if (!s) return
        s.turnsLeft = s.duration = 3
    }
}).setDesc(formatString("[a]Consumes all Charge[r] and increases the user's [a]ATK[r] by [a]1%[r] for every point of [a]Charge[r] consumed. The [a]ATK[r] boost lasts for [a]2[r] turns.")))

// Special stat boosting moves
moves.set("spstronk", new Move("Magik Sord", "status", 0, "status").set(move => {
    move.targetStat.spatk = 1
    move.targetSelf = true
}).setDesc(formatString("Increases the user's [a]SPATK[r] by [a]1[r] stage.")))

moves.set("sptonk", new Move("Magik Sheld", "status", 0, "status").set(move => {
    move.targetStat.spdef = 1
    move.targetSelf = true
}).setDesc(formatString("Increases the user's [a]SPDEF[r] by [a]1[r] stage.")))

moves.set("mind_overwork", new Move("Neuro-Overclock", "status", 0, "status").set(move => {
    move.targetSelf = true
    move.requiresMagic = 25
    move.onUse = (b, p) => {

        let s = p.status.find(v => v.type == "mind_overwork")
        if (s) {
            s.turnsLeft = s.duration
            let dmg = Math.min(Math.ceil(p.maxhp / 4), p.hp + p.plotArmor - 1)
            b.takeDamageO(p, dmg)
            return
        }
        s = b.inflictStatus(p, "mind_overwork")
        if (!s) return
        s.turnsLeft = s.duration = 3
    }
}).setDesc(
    formatString(
        "[a]Consumes all Magic[r] and applies the [a]Overclock[r] effect, increasing [a]Special ATK[r] by [a]0.5%[r] for every point of [a]Magic[r] consumed and granting [a]infinite Magic[r] for the duration of the effect. The [a]Overclock[r] effect lasts for [a]2[r] turns.\n" +
        "If the move is used while the [a]Overclock[r] effect is active, the user will [f]take damage[r] equal to [a]25%[r] of their [a]MAX HP[r] to extend the effect's duration."
    )
))

// P R O T E C T
moves.set("protect", new Move("Protect", "protect", 0, "status").set(move => move.priority = 4)
    .setDesc(formatString("Protects the user from [a]all damage[r] for the whole turn. [a]Repeated uses decrease the move's success rate.[r]")))

// Only usable in certain conditions
//moves.set("shield_breaker", new Move("Protect is Cringe", "attack", 500).set(move => {
//    move.accuracy = 100
//    move.priority = -1
//    move.breakshield = true
//    move.checkFail = function(b, p, t) {
//        return t.protect
//    }
//}).setDesc("This move can break through protect, but it can only be used if the target is protecting"))
moves.set("counter", new Move("Counter", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = 1
    move.critMul = 0.5
    move.setDamage = "set"
    move.checkFail = function(b, p, t) {
        return p.damageBlockedInTurn > 0
    }
    move.getPower = function(b, p, t) {
        return p.damageBlockedInTurn * 2
    }
}).setDesc(formatString("Deals damage equal to [a]200%[r] of the damage blocked by [a]Protect[r] in the previous turn. The target's [a]DEF[r] stat is taken into account.\nThis move has a [a]50%[r] [f]reduced[r] [a]CRIT rate[r].")))
moves.set("release", new Move("Release", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = 1
    move.setDamage = "set"
    move.critMul = 0
    move.checkFail = function (b, p, t) {
        return p.damageBlockedInTurn > 0
    }
    move.onUse = function(b, p, t) {
        let damage = Math.ceil(p.damageBlockedInTurn * 1.5)
        let enemies = b.players.filter(e => !e.dead && b.isEnemy(p, e) && e.team == t.team)
        let dist = weightedDistribution(enemies.map(e => e.hp), damage)
        let total = 0
        for (let i = 0; i < dist.length; i++) {
            b.takeDamageO(enemies[i], Math.ceil(dist[i]), { defStat: "def" })
            total += Math.ceil(dist[i])
        }
        b.logL(`dmg.release`, { damage: total })
    }
}).setDesc(formatString("Deals damage to [a]all enemies[r] on the target's team, totalling to [a]150%[r] of the damage blocked by [a]Protect[r] in the previous turn. The [a]DEF[r] stats of the targets are taken into account.\nThis move [f]cannot[r] deal [a]CRIT[r] damage.")))

moves.set("regen", new Move("Regeneration", "status", 0, "status", 100).set(move => {
    move.requiresMagic = 20
    move.targetSelf = true
    move.inflictStatus.push({
        chance: 1,
        status: "regen"
    })
}).setDesc(formatString("Grants the user [a]Regeneration[r] for [a]4[r] turns, healing them by [a]6.25%[r] of their [a]MAX HP[r] every turn while the effect is active.")))
moves.set("heal", new Move("Heal", "heal", 40, "status", 100).set(move => {
    move.requiresMagic = 30
}).setDesc(formatString("Heals the user by [a]40%[r] of their [a]MAX HP[r].")))
moves.set("revive", new Move("Revive", "status", 100, "status").set(move => {
    move.accuracy = 100
    move.priority = 1
    move.setDamage = "set"
    move.targetSelf = true
    move.requiresMagic = 60
    move.checkFail = function (b, p, t) {
        return t.dead
    }
    move.onUse = function (b, p, t) {
        t.hp = 1
        b.heal(t, t.maxhp - 1)
        b.logL("heal.revive", { player: t.toString() })
    }
}).setDesc(formatString("Revives the target with their full [a]HP[r] restored. [a]The target's held items and stat modifiers will be lost.[r]")))
//moves.set("overheal", new Move("Overheal", "heal", 150, "status", 100).set(move => {
//    move.requiresMagic = 30
//    move.userStat.atk = -12
//    move.userStat.spatk = -12
//    move.userStat.spd = -12
//}).setDesc("Heals 150% of the user's max HP, but severely lowers attack, special attack and speed"))


moves.set("pingcheck", new Move("Pingcheck", "attack", 200, "special", 100).set(el => {
    el.critMul = 0
    el.priority = -999
    el.selectable = false
    el.recoil = 0.25
    el.setDamage = "percent"
    el.userStat = {
        hp: 0,
        atk: -1,
        def: -1,
        spatk: -1,
        spdef: -1,
        spd: -1,
    }
    el.inflictStatus.push({ status: "bleed", chance: 1 })
}).setDesc(formatString("[a]ú[r]'s exclusive move that deals [a]200%[r] of the user's [a]MAX HP[r] in damage. The user takes [a]25%[r] of their [a]MAX HP[r] in damage and their [a]ATK, DEF, SPATK, SPDEF and SPD[r] are decreased by [a]1[r] stage when used.")))

moves.set("sf_slap", new Move("SF Slap", "attack", 50).set(move => {
    move.selectable = false
}).setDesc("Special move for the Slap Fight and Team Slap Fight battle types"))