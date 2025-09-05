import { moves, Move, getAoeTargets, enhanceLevelDesc } from "../../moves"
import { ffrac } from "../../number-format"
import { formatString } from "../../util"

// Physical/Special basic attacks
moves.set("bonk", new Move("Bonk", "attack", 100).set(move => {
    move.maxEnhance = 2
    move.onUseOverride = false
    move.enhanceFactor = 0.1
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

moves.set("nerf_gun", new Move("Nerf Gun", "attack", 85, "special").set(move => {
    move.multihit = 2
    move.critMul = 1.1
    move.maxEnhance = 4
    move.enhanceFactor = 0.1
    let critEnhance = 0.1
    let baseBounceMul = 0.4
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
        let target = targets[Math.floor(b.rng.get01() * targets.length)]
        if (!target) target = t
        let dmg = u.cstats.spatk * bounceMul
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