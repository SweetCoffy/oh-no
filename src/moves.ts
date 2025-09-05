import { Collection } from "discord.js"
import { Battle, calcDamage, getATK, getDEF, MoveCastOpts, Player } from "./battle.js"
import { makeStats, Stats } from "./stats.js"
import { readdir } from "fs/promises"
import { resolve } from "path"

export type MoveType = "attack" | "status" | "status_buff" | "status_debuff" | "summon" | "protect" | "heal" | "absorption" | "noop"
export type Category = "physical" | "special" | "status"
export type DamageType = "regular" | "set" | "percent"
export const moveTypeInfo: { [x in MoveType]: { emoji: string, name: string, listOrder: number } } = {
    attack: { emoji: "<:move_attack:1412964656607264828>", name: "Attack", listOrder: 0 },
    protect: { emoji: "<:move_defend:1412964676450648186>", name: "Defend", listOrder: 1 },
    heal: { emoji: "<:move_restore:1412964699665993809>", name: "Restore", listOrder: 2 },
    absorption: { emoji: "<:move_absorb:1412964688064417822>", name: "Absorb", listOrder: 3 },
    status_buff: { emoji: "<:move_buff:1412984746455203940>", name: "Support", listOrder: 4 },
    status_debuff: { emoji: "<:move_debuff:1412984757033238630>", name: "Impair", listOrder: 5 },
    status: { emoji: "<:move_support:1412964715654807684>", name: "Other Non-Damaging", listOrder: 6 },
    summon: { emoji: "<:move_summon:1412964732494807172>", name: "Summon", listOrder: 7 },
    noop: { emoji: "❓", name: "Other", listOrder: 99 }
}
export interface InflictStatus {
    status: string,
    chance: number,
}
export class Move {
    id: string = ""
    unlockLevel: number = 0
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
    maxEnhance: number = 1
    specialEnhance: number[]
    enhanceFactor: number = 0.35
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
    getDescription(el: number): string {
        return this.description
    }
    applyEnhance(mOpts: MoveCastOpts, el: number): void {

    }
    /**
     * Calculates the move's power, used for moves with variable power like Counter
     * @param b The battle
     * @param user The move's user
     * @param target The move's target
     * @returns The move's power
     */
    getBasePower(el: number = 1) {
        return (this.power || 0) * this.getEnhanceMult(el)
    }
    getPower(b: Battle, user: Player, target: Player, el: number = 1) {
        return this.getBasePower(el)
    }
    getEnhanceMult(el: number) {
        if (this.maxEnhance == 1) {
            return 1
        }
        return 1 + (el - 1) * (this.enhanceFactor / (this.maxEnhance - 1))
    }
    onUseOverride: boolean = true
    /**
     * Function to run when the move is used. If present, it will override default behaviour
     */
    onUse?: (b: Battle, user: Player, target: Player, mOpts: MoveCastOpts) => void
    supportTargetting: boolean = false
    onlyTargetSelf: boolean = false
    multihit: number = 1
    wikiHeader: string = "This is a move, which may not have all of its information shown here. Please use /choose help move:<move name> to see the full description."
    constructor(name: string, type: MoveType = "attack", power: number, category: Category = "physical", accuracy: number = 100) {
        this.type = type
        this.power = power
        this.accuracy = accuracy
        this.name = name
        this.category = category
        this.description = `N/A`
        this.specialEnhance = []
    }
    getDamage(power: number, atk: number, target: Player) {
        if (this.setDamage == "regular") {
            return atk * power / 100
        }
        if (this.setDamage == "percent") {
            return power / 100 * target.maxhp
        }
        if (this.setDamage == "set") {
            return power
        }
        return 0
    }
    selectDialogExtra(b: Battle, p: Player, enhance: number) {
        return ""
    }
    getAiAttackRank(b: Battle, p: Player, t: Player) {
        if (this.type != "attack") return 0
        if (!this.checkFail(b, p, t)) return 0
        let pow = this.getPower(b, p, t, 1)
        let atk = getATK(p, this.category)
        let dmg = this.getDamage(pow, atk, t)
        if (this.category != "status") {
            dmg = calcDamage(dmg, getDEF(t, this.category), p.level)
        }
        let dmgRank = Math.min(dmg / t.hp, 1)
        return dmgRank * 100 - (this.requiresCharge + this.requiresMagic) / 100
    }
    getAiSupportRank(b: Battle, p: Player, t: Player) {
        if (!this.checkFail(b, p, t)) return 0
        if (this.type == "attack") return 0
        return 0
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
export function getAoeTargets(b: Battle, u: Player, t: Player) {
    return b.players.filter(p => b.isEnemy(p, u) && p != t && p.team == t.team && !p.dead)
}
export function enhanceLevelDesc(el: number = 1) {
    return `· [a]Enhancement Level ${el}✦[r]`
}

moves.set("sf_slap", new Move("SF Slap", "attack", 50).set(move => {
    move.selectable = false
}).setDesc("Special move for the Slap Fight and Team Slap Fight battle types"))

export async function reloadMoves() {
    let files = await readdir("./src/battle/moves")
    for (let file of files) {
        let path = resolve(`./src/battle/moves/${file}`)
        delete require.cache[path]
        try {
            console.log(`loading move file ${file}`)
            await import(path)
        } catch(e) {
            console.error(e)
        }
    }    
    moves.sort((a, b) => {
        let typeInfoA = moveTypeInfo[a.type]
        let typeInfoB = moveTypeInfo[b.type]
        return typeInfoA.listOrder - typeInfoB.listOrder
    })
    for (let [k, v] of moves) {
        v.id = k
    }
}
await reloadMoves()