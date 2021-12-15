import Collection from "@discordjs/collection"
import { Battle, Player } from "./battle.js"
import { makeStats, Stats } from "./stats.js"
import { rng } from "./util.js"

export type MoveType = "attack" | "status" | "protect" | "noop"
export type Category = "physical" | "special" | "status"
export interface InflictStatus {
    status: string,
    chance: number,
}
export class Move {
    name: string
    category: Category = "physical"
    power: number | null = null
    accuracy: number = 100
    type: MoveType = "attack"
    priority: number = 0
    recoil: number = 0
    userStatChance: number = 1
    targetStatChance: number = 1
    targetStat: Stats = makeStats()
    userStat: Stats = makeStats()
    breakshield = false
    inflictStatus: InflictStatus[] = []
    description: string
    checkFail(b: Battle, user: Player, target: Player) {
        return true
    }
    getPower(b: Battle, user: Player, target: Player) {
        return this.power || 0
    }
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
moves.set("nerf_gun", new Move("Nerf Gun", "attack", 60, "special"))

// Physical/Special recoil attacks
moves.set("ping", new Move("Ping Attack", "attack", 150, "special").set(move => move.userStat.spatk = -2).setDesc("A quite powerful move, the user's Special Attack is lowered due to the recoil"))
moves.set("slap", new Move("Slap", "attack", 175).set(move => move.recoil = 0.25).setDesc("A quite powerful move, the user takes 25% of their Max HP due to the recoil"))

// Status inflicting moves
moves.set("twitter", new Move("Twitter", "status", 0, "status", 100).set(move => {
    move.inflictStatus.push({chance: 1, status: "poison"})
}).setDesc("Inflicts the target with poison"))

// Physical stat boosting moves
moves.set("stronk", new Move("Stronk", "status", 0, "status").set(move => move.userStat.atk = 1).setDesc("Increases the user's Attack"))
moves.set("tonk", new Move("Tonk", "status", 0, "status").set(move => move.userStat.def = 1).setDesc("Increases the user's Defense"))

// Special stat boosting moves
moves.set("spstronk", new Move("Magik Sord", "status", 0, "status").set(move => move.userStat.spatk = 1).setDesc("Increases the user's Special Attack"))
moves.set("sptonk", new Move("Magik Sheld", "status", 0, "status").set(move => move.userStat.spdef = 1).setDesc("Increases the user's Special Defense"))

// P R O T E C T
moves.set("protect", new Move("Protect", "protect", 0, "status").set(move => move.priority = 4).setDesc("Protects the user from any damage for the whole turn, sucess rate lowers the more times used"))

// Only usable in certain conditions
moves.set("shield_breaker", new Move("Protect is Cringe", "attack", 500).set(move => {
    move.accuracy = 100
    move.priority = -1
    move.breakshield = true
    move.checkFail = function(b, p, t) {
        return t.protect
    }
}).setDesc("This move can break through protect, but it can only be used if the target is protecting"))
moves.set("counter", new Move("Counter", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = 5
    move.checkFail = function(b, p, t) {
        return p.damageBlockedInTurn > 0
    }
    move.getPower = function(b, p, t) {
        return (p.damageBlockedInTurn / p.stats.hp) * 500
    }
}).setDesc("This move's power depends on how much damage was blocked with Protect in the previous turn"))