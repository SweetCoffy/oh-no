import { Collection } from "discord.js"
import { Battle, calcDamage, getATK, getDEF, MoveCastOpts, Player } from "./battle.js"
import { calcStats, ExtendedStatID, makeStats, StatID, Stats } from "./stats.js"
import { formatString, weightedDistribution, weightedRandom } from "./util.js"
import { moveCursor } from "readline"
import { ffrac, fnum } from "./number-format.js"
import { StatusID } from "./gen.js"
import { enemies } from "./enemies.js"
import { getString } from "./locale.js"

export type MoveType = "attack" | "status" | "protect" | "heal" | "absorption" | "noop"
export type Category = "physical" | "special" | "status"
export type DamageType = "regular" | "set" | "percent"
export interface InflictStatus {
    status: string,
    chance: number,
}
export class Move {
    id: string = ""
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
        return 1 + (el - 1)*(this.enhanceFactor / (this.maxEnhance - 1))
    }
    onUseOverride: boolean = true
    /**
     * Function to run when the move is used. If present, it will override default behaviour
     */
    onUse?: (b: Battle, user: Player, target: Player, mOpts: MoveCastOpts) => void
    /**
     * Whether or not this move hits all enemies in PvE mode. Currently not implemented and probably getting removed
     */
    hitAll: boolean = false
    targetSelf: boolean = false
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
function getAoeTargets(b: Battle, u: Player, t: Player) {
    return b.players.filter(p => b.isEnemy(p, u) && p != t && p.team == t.team && !p.dead)
}
// Physical/Special basic attacks
moves.set("bonk", new Move("Bonk", "attack", 110).set(move => {
    move.maxEnhance = 2
    move.onUseOverride = false
    let blastMult = 0.25
    move.specialEnhance = [2]
    move.getDescription = (el) => {
        let desc = move.description
        if (el >= 2) {
            let blastStr = ffrac(blastMult * move.getEnhanceMult(el))
            desc += formatString(`\n${enhanceLevelDesc(2)}: Causes an [a]AoE[r] that deals damage to everyone on the main target's team equal [a]${blastStr}[r] of the user's [a]ATK[r].`)
        }
        return desc
    }
    move.onUse = (b, u, t, { enhance }) => {
        if (enhance >= 2) {
            let targets = getAoeTargets(b, u, t)
            let blast = blastMult * move.getEnhanceMult(enhance)
            let base = u.cstats.atk
            for (let target of targets) {
                let dmg = base * blast
                b.takeDamageO(target, dmg, {
                    atkLvl: u.level,
                    defStat: "def",
                })
            }
        }
    }
}))
moves.set("needle", new Move("Needle", "attack", 5, "physical", 100).set(move => {
    move.inflictStatus.push({ status: "bleed", chance: 1 })
    move.setDamage = "percent"
    move.requiresCharge = 5
}).setDesc(formatString("Deals fixed damage equal to [a]5%[r] of the target's [a]MAX HP[r] and inflicts them with [a]Bleed[r]")))
moves.set("nerf_gun", new Move("Nerf Gun", "attack", 90, "special").set(move => {
    move.multihit = 2
    move.critMul = 1.1
    move.maxEnhance = 4
    move.enhanceFactor = 0.2
    let critEnhance = 0.1
    let baseBounceMul = 0.7
    move.applyEnhance = (opts, el) => {
        opts.critMul *= 1 + critEnhance * (el - 1)
    }
    move.onUseOverride = false
    move.onUse = (b, u, t, { enhance }) => {
        if (enhance < 4) {
            return
        }
        let bounceMul = baseBounceMul
        let targets = getAoeTargets(b, u, t)
        targets.push(t)
        let target = targets[Math.floor(b.rng.get01()*targets.length)]
        if (!target) target = t
        let dmg = u.cstats.spatk*bounceMul
        b.takeDamageO(target, dmg, {
            atkLvl: u.level,
            defStat: "spdef",

        })
    }
    move.specialEnhance = [4]
    move.getDescription = (el) => {
        let bounceMul = baseBounceMul
        let crit = move.critMul * (1 + critEnhance * (el - 1))
        let desc = `A basic attack that deals damage across [a]2[r] hits.\nThis move has a [a]${ffrac(crit)} CRIT Rate multiplier[r]`
        if (el >= 4) {
            desc += `\n${enhanceLevelDesc(4)}: Hits a random player in the target's team, dealing damage equal to [a]${ffrac(bounceMul)}[r] of [a]Special ATK[r]. This additional hit cannot CRIT and may hit the main target again.`
        }
        return formatString(desc)
    }
    move.description = move.getDescription(1)
}))

// Physical/Special recoil attacks
moves.set("ping", new Move("Ping Attack", "attack", 290, "special").set(move => {
    move.requiresMagic = 30
    move.maxEnhance = 4
}).setDesc(formatString("A strong [a]Special[r] move that requires [a]Magic[r] to use.")))
moves.set("slap", new Move("Slap", "attack", 300).set(move => {
    move.requiresCharge = 15
    move.maxEnhance = 4
    move.onUseOverride = false
    let blastMult = 0.4
    let blastSummonMult = 0.6
    move.specialEnhance = [2, 4]
    move.getDescription = (el) => {
        let desc = move.description
        if (el >= 2) {
            let blastStr = ffrac(blastMult * move.getEnhanceMult(el))
            let blastSummonStr = ffrac(blastSummonMult * move.getEnhanceMult(el))
            desc += formatString(`\n${enhanceLevelDesc(2)}: Causes an [a]AoE[r] that deals damage to everyone on the main target's team equal [a]${blastStr}[r] of the user's [a]ATK[r]. For any summons of the main target, the multiplier is increased to [a]${blastSummonStr}[r].`)
        }
        if (el >= 4) {
            desc += formatString(`\n${enhanceLevelDesc(4)}: Inflicts [a]Delayed Pain[r] on the main target.`)
        }
        return desc
    }
    move.onUse = (b, u, t, {enhance}) => {
        if (enhance >= 2) {
            let targets = getAoeTargets(b, u, t)
            let blast = blastMult * move.getEnhanceMult(enhance)
            let blastSummon = blastSummonMult * move.getEnhanceMult(enhance)
            let base = u.cstats.atk
            for (let target of targets) {
                let mult = blast
                if (target.summoner == t) {
                    mult = blastSummon
                }
                let dmg = base * mult
                b.takeDamageO(target, dmg, {
                    atkLvl: u.level,
                    defStat: "def",
                })
            }
        }
        if (enhance >= 4) {
            b.inflictStatus(t, "delayed_pain")
        }
    }
}).setDesc(formatString("A strong [a]Physical[r] move that requires [a]Charge[r] to use.")))
moves.set("boulder", new Move("Break: Tactical Homing Boulder", "attack", 130, "physical", 100).set(move => {
    move.requiresCharge = 30
    move.requiresMagic = 30
    move.maxEnhance = 2
    move.critMul = 0
    move.getDescription = (el) => {
        let multstr = ffrac(move.getBasePower(el)/100)
        return formatString(`Deals [a]defense-ignoring[r] damage equal to [a]${multstr}[r] of [a]ATK[r] + [a]${multstr}[r] of [a]Special ATK[r] and inflicts [a]Broken[r].\nThis move [a]cannot CRIT[r].`)
    }
    move.description = move.getDescription(1)
    move.onUse = (b, p, t, { enhance }) => {
        const dmg = (p.cstats.atk + p.cstats.spatk)*move.getBasePower(enhance)/100
        let s = b.inflictStatus(t, "broken")
        b.takeDamageO(t, dmg, {
            inflictor: p,
            type: "none",
        })
    }
}))
function summonOnUse(summonType: string, levelFrac: number = 0.9) {
    return function(b: Battle, p: Player, t: Player) {
        let found = p.findSummon(summonType)
        if (!found) {
            let s = p.createSummon(b, summonType, levelFrac)
            if (!s) b.logL("move.fail", {})
            return
        }
        let healAmount = found.cstats.hp - found.hp
        b.heal(found, healAmount)
    }
}
function summonDesc(summonType: string, levelFrac: number = 0.9) {
    let testLevels = [20, 50, 100]
    let e = enemies.get(summonType)
    if (!e) return ""
    let testStats = testLevels.map(level => calcStats(Math.ceil(level*levelFrac), e.stats))
    let statList = Object.keys(testStats[0]) as StatID[]
    let pad = 6
    let statsString = `${"(Levels:".padEnd(14)} ${testLevels.map(level => `[a]${level.toString().padStart(pad)}[r]`).join("/")})\n` + statList.map(stat => {
        let name = getString(`stat.${stat}`)
        return `${(name + ":").padEnd(14)} ${testLevels.map((_, i) => {
            let val = testStats[i][stat]
            return `[a]${fnum(val).padStart(pad)}[r]`
        }).join("/")}`
    }).join("\n")
    let movesString = e.moveset.map(m => moves.get(m)?.name).join(", ")
    return formatString(`[a]${e.name}[r]:\n${e.description}\n${statsString}\nMoves: ${movesString}`)
}
moves.set("summon_eh", new Move("Summon: Egg Hater", "status", 0, "status").set(move => {
    move.requiresMagic = 30
    move.onUse = summonOnUse("egg_hater", 1.0)
    queueMicrotask(() => {
        move.description = summonDesc("egg_hater")
    })
}))
moves.set("summon_u", new Move("Summon: ú", "status", 0, "status").set(move => {
    move.requiresMagic = 40
    move.onUse = summonOnUse("u", 0.6)
    queueMicrotask(() => {
        move.description = summonDesc("u", 0.6)
    })
}))
// Status inflicting moves
moves.set("twitter", new Move("Twitter", "status", 0, "status", 100).set(move => {
    move.inflictStatus.push({ chance: 1, status: "poison" })
    move.requiresMagic = 10
    move.getAiAttackRank = (b, p, t) => {
        let s = t.status.find(v => v.type == "poison")
        if (s && s.turnsLeft > 1) return -1
        let dmg = p.cstats.spatk / 5 * 4
        return Math.min(t.hp / dmg, 1) * 100
    }
}).setDesc(formatString("Inflicts the target with [a]Poison[r]")))

// Physical stat boosting moves
moves.set("stronk", new Move("Stronk", "status", 0, "status").set(move => {
    move.targetStat.atk = 1
    move.targetSelf = true
}).setDesc(formatString("Increases the user's [a]ATK[r] by [a]1[r] stage.")))

// moves.set("tonk", new Move("Tonk", "status", 0, "status").set(move => {
//     move.targetStat.def = 1
//     move.targetSelf = true
// }).setDesc(formatString("Increases the user's [a]DEF[r] by [a]1[r] stage.")))

moves.set("reckless_rush", new Move("Reckless Rush", "status", 0, "status").set(move => {
    move.targetSelf = true
    move.requiresCharge = 20
    move.maxEnhance = 2
    let baseDuration = 2
    move.onUse = (b, p, _, { enhance }) => {
        let s = b.inflictStatus(p, "rush")
        if (!s) return
        s.turnsLeft = s.duration = baseDuration + enhance - 1
    }
    move.getAiSupportRank = (b, p, t) => {
        if (t != p) return 0
        if (p.status.some(v => v.type == "rush")) return 0
        return Math.min(p.cstats.atk / p.cstats.spatk, 1.5) * p.charge
    }
    move.getDescription = (el) => {
        let duration = baseDuration + el - 1
        return formatString(`[a]Consumes all Charge[r] and increases the user's [a]ATK[r] by [a]1%[r] for every point of [a]Charge[r] consumed. The [a]ATK[r] boost lasts for [a]${duration}[r] turns.`)
    }
    move.description = move.getDescription(1)
}))

// Special stat boosting moves
moves.set("spstronk", new Move("Magik Sord", "status", 0, "status").set(move => {
    move.targetStat.spatk = 1
    move.targetSelf = true
}).setDesc(formatString("Increases the user's [a]SPATK[r] by [a]1[r] stage.")))

// moves.set("sptonk", new Move("Magik Sheld", "status", 0, "status").set(move => {
//     move.targetStat.spdef = 1
//     move.targetSelf = true
// }).setDesc(formatString("Increases the user's [a]SPDEF[r] by [a]1[r] stage.")))

moves.set("mind_overwork", new Move("Neuro-Overclock", "status", 0, "status").set(move => {
    move.targetSelf = true
    move.requiresMagic = 25
    move.maxEnhance = 2
    let baseDuration = 3
    move.onUse = (b, p, _, { enhance }) => {
        let s = p.status.find(v => v.type == "mind_overwork")
        if (s) {
            s.turnsLeft = s.duration
            let dmg = Math.min(Math.ceil(p.maxhp / 4), p.hp + p.plotArmor - 1)
            b.takeDamageO(p, dmg)
            return
        }
        s = b.inflictStatus(p, "mind_overwork")
        if (!s) return
        s.turnsLeft = s.duration = baseDuration + enhance - 1
    }
    move.selectDialogExtra = (b, p) => {
        if (p.status.some(v => v.type == "mind_overwork")) {
            return "⚠️ **You will take damage to refresh the effect."
        }
        return ""
    }
    move.getAiSupportRank = (b, p, t) => {
        if (t != p) return 0
        if (p.status.some(v => v.type == "mind_overwork")) return 0
        return Math.min(p.cstats.spatk / p.cstats.atk, 1.5) * p.magic * 0.5 + 10
    }
    move.getDescription = (el) => {
        let duration = baseDuration + el - 1
        return formatString(
            `[a]Consumes all Magic[r] and applies the [a]Overclock[r] effect, increasing [a]Special ATK[r] by [a]0.5%[r] for every point of [a]Magic[r] consumed and granting [a]infinite Magic[r] for the duration of the effect. The [a]Overclock[r] effect lasts for [a]${duration}[r] turns.\n` +
            "If the move is used while the [a]Overclock[r] effect is active, the user will [f]take damage[r] equal to [a]25%[r] of their [a]MAX HP[r] to extend the effect's duration."
        )
    }
    move.description = move.getDescription(1)
}))

// P R O T E C T
moves.set("protect", new Move("Protect", "protect", 0, "status").set(move => {
    move.priority = 4
    move.getAiSupportRank = (b, p, t) => {
        if (t.dead) return 0
        let effectiveHp = t.hp + t.plotArmor
        let enemies = b.players.filter(e => !e.dead && b.isEnemy(p, e))
        let enemiesDmgPotential = enemies.map(e => {
            let atk = Math.max(e.cstats.atk, e.cstats.spatk)
            let testPower = 0.8
            let dmg = calcDamage(testPower * atk, Math.min(t.cstats.def, t.cstats.spdef), e.level)
            let dmgPercent = Math.min(dmg / effectiveHp, 1)
            return dmgPercent * 80
        })
        return Math.max(0, ...enemiesDmgPotential) * (1 / (p.protectTurns + 1))
    }
})
    .setDesc(formatString("Significantly reduces [a]all damage[r] taken by the user for the whole turn. [a]Repeated uses decrease the move's success rate.[r]\nThe maximum damage blocked per instance is equal to [a]70%[r] of the [a]incoming damage[r] plus the user's [a]DEF[r]/[a]Special DEF[r] for [a]Physical[r]/[a]Special[r] damage.\nFor [a]Status[r] damage, a fixed [a]50%[r] is blocked instead.")))

moves.set("support_absorption", new Move("Support: Iron Dome Defense System", "status", 90, "status", 100).set(move => {
    move.requiresMagic = 20
    move.targetSelf = true
    move.maxEnhance = 4
    move.enhanceFactor = 0.5
    move.getDescription = (el) => {
        let pow = move.getBasePower(el)
        return formatString(`Grants all alies [a]100% efficient Absorption[r] equal to [a]${ffrac(pow / 100)}[r] of the user's [a]Special DEF[r]. If an ally already has Absorption from this move, it is refreshed.\nWhen the [a]Absorption[r] from this move is consumed, the [a]user[r] will take [a]100%[r] of the damage absorbed as [a]Special[r] damage.`)
    }
    move.description = move.getDescription(1)
    move.onUse = (b, p, _) => {
        let id = p.id + "_support_absorption"
        let mult = move.getPower(b, p, _, p.getEnhanceLevel(move.id)) / 100
        for (let player of b.players) {
            if (b.isEnemy(player, p)) continue
            let v = p.cstats.spdef * mult
            let mod = player.absorptionMods.find(v => v.id == id)
            if (!mod) {
                mod = player.addAbsorption({
                    initialValue: v,
                    efficiency: p == player ? 0.5 : 1.0,
                    dmgRedirect: p == player ? undefined : p,
                    dmgRedirectFrac: 1.0,
                })
                mod.id = id
            } else {
                mod.initialValue = v
                mod.value = v
            }
            b.logL("move.absorption", { player: player.toString() })
        }
    }
}))


type GachaBuff = { name: string } & ({ type: "magic", amount: number } |
{ type: "charge", amount: number } |
{ type: "heal", amount: number } |
{ type: "stage_boost", stat: ExtendedStatID, amount: number } |
{ type: "effect", id: StatusID } |
{ type: "absorption", amount: number } |
{ type: "multi_stage_boost", stats: ExtendedStatID[], amount: number })

const gachaCommonPool: GachaBuff[] = [
    { type: "absorption", amount: 0.05, name: "5% Absorption" },
    { type: "charge", amount: 5, name: "5 Charge" },
    { type: "magic", amount: 5, name: "5 Magic" },
    { type: "heal", amount: 0.01, name: "1% Heal" },
    { type: "stage_boost", stat: "spd", amount: 1, name: "Small Speed Boost" },

]
const gachaUncommonPool: GachaBuff[] = [
    { type: "absorption", amount: 0.2, name: "20% Absorption" },
    { type: "charge", amount: 20, name: "20 Charge" },
    { type: "magic", amount: 20, name: "20 Magic" },
    { type: "heal", amount: 0.15, name: "15% Heal" },
    { type: "effect", id: "regen", name: "Regeneration" },
    { type: "stage_boost", stat: "spd", amount: 2, name: "Mid Speed Boost" },
    { type: "multi_stage_boost", stats: ["atk", "spatk"], amount: 1, name: "Small Attack Boost" },
]
const gachaRarePool: GachaBuff[] = [
    { type: "absorption", amount: 1.1, name: "110% Absorption" },
    { type: "charge", amount: 200, name: "200 Charge" },
    { type: "magic", amount: 200, name: "200 Magic" },
    { type: "heal", amount: 1.0, name: "100% Heal" },
    { type: "stage_boost", stat: "spd", amount: 8, name: "Massive Speed Boost" },
    { type: "multi_stage_boost", stats: ["atk", "spatk"], amount: 6, name: "Big Attack Boost" },
    {
        type: "multi_stage_boost", stats: ["atk", "spatk", "spdef", "def", "spd"],
        amount: 2,
        name: "All-Stat Boost"
    }
]

const gachaRarityPools = [
    [60, { label: "Common", pool: gachaCommonPool }],
    [33, { label: "Uncommon", pool: gachaUncommonPool }],
    [7, { label: "Rare", pool: gachaRarePool }]
] as const
function applyGachaEffect(b: Battle, p: Player, e: GachaBuff, inf?: Player) {
    switch (e.type) {
        case "magic":
            p.magic += e.amount
            b.logL("move.magic.gain", { player: p.toString(), amount: e.amount })
            break
        case "charge":
            p.charge += e.amount
            b.logL("move.charge.gain", { player: p.toString(), amount: e.amount })
            break
        case "absorption":
            b.logL("move.absorption", { player: p.toString() })
            p.addAbsorption({
                initialValue: Math.ceil(e.amount * p.cstats.hp),
                efficiency: 1
            })
            break
        case "heal":
            b.heal(p, Math.ceil(e.amount * p.cstats.hp))
            break
        case "stage_boost":
            b.statBoost(p, e.stat, e.amount)
            break
        case "effect":
            b.inflictStatus(p, e.id, inf)
            break
        case "multi_stage_boost":
            for (let stat of e.stats) {
                b.statBoost(p, stat, e.amount)
            }
            break
    }
}
moves.set("support_gacha", new Move("Support: Gacha", "status", 0, "status").set(move => {
    move.requiresMagic = 5
    move.maxEnhance = 2
    move.priority = 1
    move.targetSelf = true
    let baseMinRolls = 1
    let baseMaxRolls = 3
    let chances = weightedDistribution(gachaRarityPools.map(v => v[0]), 1)
    let pairs = gachaRarityPools.map((v, i) => [chances[i], v[1].label] as const)
    move.getDescription = (el) => {
        let minRolls = baseMinRolls + el - 1
        let maxRolls = baseMaxRolls + el - 1
        return formatString(`Pulls [a]${minRolls}[r] to [a]${maxRolls}[r] times for effects. The probabilities are as follows:\n` +
            pairs.map(([chance, name], i) => `[a]${ffrac(chance)}[r] for [a]${name}[r] pulls, which may contain:\n` +
                gachaRarityPools[i][1].pool.map(v => `· ${v.name} ([a]${ffrac(chance / gachaRarityPools[i][1].pool.length)}[r])`).join("\n")
            ).join("\n"))
    }
    move.description = move.getDescription(1)
    move.onUse = (b, u, t, { enhance }) => {
        let minRolls = baseMinRolls + enhance - 1
        let maxRolls = baseMaxRolls + enhance - 1
        let pullCount = minRolls + Math.floor(b.rng.get01()*(maxRolls-minRolls-1))
        for (let _ = 0; _ < pullCount; _++) {
            let pool = weightedRandom(gachaRarityPools.map(([a, b]) => [b, a] as const), b.rng.get01.bind(b.rng))
            let result = pool.pool[Math.floor(pool.pool.length * b.rng.get01())]
            b.logL("move.gacha", { rarity: pool.label, result: result.name })
            applyGachaEffect(b, t, result, u)
        }
    }
}))

// Only usable in certain conditions
moves.set("shield_breaker", new Move("Break: Armor-Piercing Shell", "attack", 500).set(move => {
    move.accuracy = 100
    move.priority = -2
    move.breakshield = true
    move.power = null
    move.critMul = 2
    move.onUse = function (b, p, t) {
        let dmgMult = b.critRoll(p, t, 2)
        b.logL("dmg.breakthrough", { player: p.toString() })
        p.protect = false
        let dmg = Math.ceil(p.cstats.atk * 1.2 + t.cstats.def * 0.5 * dmgMult)
        b.takeDamageO(t, dmg, {
            inflictor: t,
            type: "physical",
            atkLvl: p.level,
            defStat: "def",
        })
    }
    move.inflictStatus.push({
        status: "broken",
        chance: 1
    })
    move.getAiAttackRank = (b, p, t) => {
        return 0
    }
    move.checkFail = function (b, p, t) {
        return t.protect
    }
}).setDesc(formatString("A powerful move that can only be used on a [a]protected[r] target. On hit, it breaks the target's protection, deals damage equal to [a]120%[r] of your [a]ATK[r] + [a]50%[r] of the target's [a]DEF[r], and inflicts [a]Broken[r] for [a]2[r] turns.")))
moves.set("counter", new Move("Counter: Anti-Material Rifle", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = -2
    move.critMul = 0.5
    move.setDamage = "set"
    move.selectDialogExtra = (b, p) => {
        let dmg = move.getPower(b, p, p)
        return `ℹ️ Estimated damage: **${fnum(dmg)}**`
    }
    move.checkFail = function (b, p, t) {
        return p.damageBlockedInTurn > 0 || p.damageTakenInTurn > 0
    }
    move.getPower = function (b, p, t) {
        return Math.ceil(p.damageTakenInTurn * 1.5 + p.damageBlockedInTurn * 0.9)
    }

}).setDesc(formatString("Deals damage equal to [a]150%[r] of the damage taken in the previous turn + [a]90%[r] of any damage blocked by shielding moves (eg. [a]Protect[r]). The target's [a]DEF[r] stat is taken into account.\nThis move has a [a]50% CRIT Rate multiplier[r].\nThis move has [a]-2 priority[r]")))
moves.set("release", new Move("Counter: High Explosive Squash Head", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = -2
    move.setDamage = "set"
    move.critMul = 0
    move.checkFail = function (b, p, t) {
        return p.damageBlockedInTurn > 0 || p.damageTakenInTurn > 0
    }
    move.getPower = (b, u, t) => {
        return Math.ceil(u.damageBlockedInTurn * 0.9 + u.damageTakenInTurn * 1.5)
    }
    move.selectDialogExtra = (b, p) => {
        let dmg = Math.ceil(p.damageBlockedInTurn * 0.8)
        return `ℹ️ Estimated damage: **${fnum(dmg)}**`
    }
    move.getAiAttackRank = function (b, p, t) {
        let targets = b.players.filter(e => !e.dead && e.team == t.team)
        let dmgPerTarget = p.damageBlockedInTurn * 0.8 / targets.length
        if (targets.length == 0) return 0
        return targets.map(p => dmgPerTarget / (p.hp + p.plotArmor)).reduce((a, b) => a + b, 0) * 100
    }
    move.onUse = function (b, p, t) {
        let damage = Math.ceil(p.damageBlockedInTurn * 0.8)
        let enemies = b.players.filter(e => !e.dead && b.isEnemy(p, e) && e.team == t.team)
        let dist = weightedDistribution(enemies.map(e => e.hp), damage)
        let total = 0
        for (let i = 0; i < dist.length; i++) {
            b.takeDamageO(enemies[i], Math.ceil(dist[i]), { defStat: "def" })
            total += Math.ceil(dist[i])
        }
        b.logL(`dmg.release`, { damage: total })
    }
}).setDesc(formatString("Deals damage to [a]all enemies[r] on the target's team, adding up to [a]80%[r] of the damage blocked by [a]Protect[r] in the previous turn. The [a]DEF[r] stats of the targets are taken into account.\nThis move [f]cannot[r] [a]CRIT[r].")))

moves.set("regen", new Move("Regeneration", "status", 0, "status", 100).set(move => {
    move.requiresMagic = 20
    move.targetSelf = true
    move.inflictStatus.push({
        chance: 1,
        status: "regen"
    })
    move.getAiSupportRank = (b, p, t) => {
        if (t.dead) return -99
        if (t.hp > t.maxhp * 0.8) return -98
        let healAmt = Math.ceil(t.maxhp * 0.2)
        let healDelta = Math.min((t.hp + healAmt) / t.maxhp, 1) - (t.hp / t.maxhp)
        if (healAmt > t.maxhp - t.hp) healDelta -= 0.05
        return (healDelta * 100) + (1 - t.hp / t.maxhp) * 50
    }
}).setDesc(formatString("Grants the target [a]Regeneration[r] for [a]4[r] turns.")))
function enhanceLevelDesc(el: number = 1) {
    return `· [a]Enhancement Level ${el}✦[r]`
}
moves.set("heal", new Move("Heal", "heal", 40, "status", 100).set(move => {
    move.requiresMagic = 30
    move.targetSelf = true
    move.maxEnhance = 4
    move.enhanceFactor = 0.6
    move.onUseOverride = false
    move.specialEnhance = [4]
    move.getDescription = (el) => {
        let pow = move.getBasePower(el)
        let desc = `Heals the target by [a]${ffrac(pow / 100)}[r] of the user's [a]Max HP[r].`
        if (el >= 4) {
            desc += `\n${enhanceLevelDesc(4)}: The target's [a]Max HP[r] is increased by [a]15%[r] of the user's [a]Max HP[r] for [a]4[r] turns.`
        }
        return formatString(desc)
    }
    move.description = move.getDescription(1)
    move.onUse = (b, u, t, {enhance}) => {
        if (enhance >= 4) {
            b.inflictStatus(t, "health_boost", u)
        }
    }
    move.getAiSupportRank = (b, p, t) => {
        if (t.dead) return -99
        if (t.hp > t.maxhp * 0.8) return -98
        let healAmt = Math.ceil(t.maxhp * move.getBasePower(p.getEnhanceLevel(move.id)) / 100)
        let healDelta = Math.min((t.hp + healAmt) / t.maxhp, 1) - (t.hp / t.maxhp)
        if (healAmt > t.maxhp - t.hp) healDelta -= 0.05
        return (healDelta * 100) + (1 - t.hp / t.maxhp) * 50
    }
}))
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


moves.set("pingcheck", new Move("Pingcheck", "attack", 0, "special", 100).set(el => {
    el.critMul = 0
    el.priority = -2
    el.selectable = false
    el.recoil = 0.25
    el.requiresCharge = 30
    el.setDamage = "set"
    el.getPower = (b, u, t, enhance = 1) => {
        return u.cstats.hp * 1.5 * el.getEnhanceMult(enhance)
    }
    el.onUse = (b, u, t) => {
        let pow = el.getPower(b, u, t, u.getEnhanceLevel(el.id))
        if (u.summoner) {
            u.moveset = u.moveset.filter(m => m != "pingcheck")
        }
        b.takeDamageO(t, pow, {
            atkLvl: u.level,
            defStat: "def",
            type: "physical"
        })
    }
    el.inflictStatus.push({ status: "bleed", chance: 1 })
}).setDesc(formatString("[a]ú[r]'s exclusive move that deals damage equal to [a]150%[r] of its own [a]Max HP[r], while consuming [a]HP[r] equal to [a]25%[r] of its [a]Max HP[r]. If ú was summoned by a player, this move cannot be used again.")))

moves.set("sf_slap", new Move("SF Slap", "attack", 50).set(move => {
    move.selectable = false
}).setDesc("Special move for the Slap Fight and Team Slap Fight battle types"))

for (let [k, v] of moves) {
    v.id = k
}