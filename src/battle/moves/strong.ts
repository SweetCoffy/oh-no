import { moves, Move, enhanceLevelDesc, getAoeTargets } from "../../moves"
import { ffrac } from "../../number-format"
import { formatString } from "../../util"

// Physical/Special recoil attacks
moves.set("ping", new Move("Ping Attack", "attack", 210, "special").set(move => {
    move.requiresMagic = 30
    move.maxEnhance = 4
    move.unlockLevel = 10
}).setDesc(formatString("A strong [a]Special[r] move that requires [a]Magic[r] to use.")))
moves.set("slap", new Move("Slap", "attack", 220).set(move => {
    move.requiresCharge = 15
    move.maxEnhance = 4
    move.onUseOverride = false
    move.unlockLevel = 10
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
    move.onUse = (b, u, t, { enhance }) => {
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
    move.unlockLevel = 40
    move.atkTypeless = true
    move.getDescription = (el) => {
        let multstr = ffrac(move.getBasePower(el) / 100)
        return formatString(`Deals [a]defense-ignoring[r] damage equal to [a]${multstr}[r] of [a]ATK[r] + [a]${multstr}[r] of [a]Special ATK[r] and inflicts [a]Broken[r].\nThis move [a]cannot CRIT[r].`)
    }
    move.description = move.getDescription(1)
    move.onUse = (b, p, t, { enhance }) => {
        const dmg = (p.cstats.atk + p.cstats.spatk) * move.getBasePower(enhance) / 100
        let s = b.inflictStatus(t, "broken")
        b.takeDamageO(t, dmg, {
            inflictor: p,
            type: "none",
        })
    }
}))
moves.set("shield_breaker", new Move("Break: Armor-Piercing Shell", "attack", 500).set(move => {
    move.accuracy = 100
    move.priority = -2
    move.breakshield = true
    move.power = null
    move.critMul = 2
    move.unlockLevel = 30
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
