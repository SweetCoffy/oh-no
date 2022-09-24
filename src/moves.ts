import Collection from "@discordjs/collection"
import { Battle, calcMul, Player } from "./battle.js"
import { makeStats, Stats } from "./stats.js"
import { rng, lerp, weightedDistribution } from "./util.js"

export type MoveType = "attack" | "status" | "protect" | "heal" | "absorption" | "noop"
export type Category = "physical" | "special" | "status"
export type DamageType = "regular" | "set" | "set-atkdef" | "percent"
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
     * `regular` Regular damage calculations
     * 
     * `set` No damage calculations, fixed damage
     * 
     * `set-atkdef` No damage calculations, fixed damage multiplied by `def/atk`
     * 
     * `percent` No damage calculations, damage is `power` % of the target's max hp
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
     * `status` Doesn't use damage calculations as it is meant for moves that only inflict a status condition or change stats
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
export var moves: Collection<string, Move> = new Collection()

// Physical/Special basic attacks
moves.set("bonk", new Move("Bonk", "attack", 60))
moves.set("needle", new Move("Needle", "attack", 100/16, "physical", 80).set(move => {
    move.inflictStatus.push({ status: "bleed", chance: 1 })
    move.setDamage = "percent"
}).setDesc("A weak move that will always do the same amount of damage. Can also make the target Bleed"))
moves.set("nerf_gun", new Move("Nerf Gun", "attack", 60, "special"))

// Physical/Special recoil attacks
moves.set("ping", new Move("Ping Attack", "attack", 190, "special").set(move => {
    move.requiresMagic = 30
    move.targetStatChance = 0.5
}).setDesc("A quite powerful move, the user's Special Attack is lowered due to the recoil"))
moves.set("slap", new Move("Slap", "attack", 190).set(move => {
    move.userStat.atk = -1
    move.requiresCharge = 15
    move.targetStatChance = 0.5
}).setDesc("A quite powerful move, the user takes an eight of their Max HP due to the recoil"))

// Status inflicting moves
moves.set("twitter", new Move("Twitter", "status", 0, "status", 90).set(move => {
    move.inflictStatus.push({chance: 1, status: "poison"})
    move.userStat.def = -1
    move.userStat.spdef = -1
}).setDesc("Inflicts the target with poison"))

// Physical stat boosting moves
moves.set("stronk", new Move("Stronk", "status", 0, "status").set(move => {
    move.targetStat.atk = 1
    move.targetSelf = true
}).setDesc("Increases the user's Attack"))

moves.set("tonk", new Move("Tonk", "status", 0, "status").set(move => {
    move.targetStat.def = 1
    move.targetSelf = true
}).setDesc("Increases the user's Defense"))

moves.set("reckless_rush", new Move("Reckless Rush", "status", 0, "status").set(move => {
    move.targetStat.spdef = -2
    move.targetStat.def = -2
    move.targetStat.atk = 3
    move.targetSelf = true
}).setDesc("Increases the user's Attack drastically but lowers Defense and Special Defense harshly"))

// Special stat boosting moves
moves.set("spstronk", new Move("Magik Sord", "status", 0, "status").set(move => {
    move.targetStat.spatk = 1
    move.targetSelf = true
}).setDesc("Increases the user's Special Attack"))

moves.set("sptonk", new Move("Magik Sheld", "status", 0, "status").set(move => {
    move.targetStat.spdef = 1
    move.targetSelf = true
}).setDesc("Increases the user's Special Defense"))

moves.set("mind_overwork", new Move("Neuro-Overclock", "status", 0, "status").set(move => {
    move.targetStat.spatk = 3
    move.recoil = 0.15
    move.userStat.spdef = -1
    move.userStat.def = -1
    move.targetSelf = true
}).setDesc("Increases the user's Special Attack drastically. However, it costs some HP to use"))

// P R O T E C T
moves.set("protect", new Move("Protect", "protect", 0, "status").set(move => move.priority = 4).setDesc("Protects the user from any damage for the whole turn, sucess rate lowers the more times used"))

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
    move.setDamage = "set"
    move.checkFail = function(b, p, t) {
        return p.damageBlockedInTurn > 0
    }
    move.getPower = function(b, p, t) {
        return p.damageBlockedInTurn * 2
    }
}).setDesc("This move deals double the damage blocked by Protect in the previous turn"))
moves.set("release", new Move("Release", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = 1
    move.setDamage = "set"
    move.checkFail = function (b, p, t) {
        return p.damageBlockedInTurn > 0
    }
    move.onUse = function(b, p, t) {
        let damage = Math.ceil(p.damageBlockedInTurn * 1.75)
        let enemies = b.players.filter(e => e.hp > -e.plotArmor && b.isEnemy(p, e))
        let dist = weightedDistribution(enemies.map(e => e.hp), damage)
        let total = 0
        for (let i = 0; i < dist.length; i++) {
            b.takeDamage(enemies[i], Math.ceil(dist[i]))
            total += Math.ceil(dist[i])
        }
        b.logL(`dmg.release`, { damage: total })
    }
}).setDesc("A different version of Counter, which deals less damage overall and is unable to do critical hits, but distributes the damage across all enemies"))

moves.set("regen", new Move("Regeneration", "status", 0, "status", 100).set(move => {
    move.requiresMagic = 20
    move.targetSelf = true
    move.inflictStatus.push({
        chance: 1,
        status: "regen"
    }, {
        chance: 0.1,
        status: "strong_regen"
    })
}).setDesc("Grants the user Regeneration, slowly healing them over time"))
moves.set("heal", new Move("Heal", "heal", 40, "status", 100).set(move => {
    move.requiresMagic = 30
}).setDesc("A basic healing move, restores 40% of the user's max hp"))

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
}).setDesc("ú's exclusive move. This move is guaranteed to 1-hit KO anything"))