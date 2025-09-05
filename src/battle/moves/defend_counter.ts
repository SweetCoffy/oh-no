import { calcDamage } from "../../battle"
import { moves, Move } from "../../moves"
import { fnum } from "../../number-format"
import { formatString, weightedDistribution } from "../../util"

moves.set("protect", new Move("Protect", "protect", 0, "status").set(move => {
    move.priority = 4
    move.unlockLevel = 5
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

moves.set("counter", new Move("Counter: Anti-Material Rifle", "attack", 0).set(move => {
    move.accuracy = 100
    move.priority = -2
    move.critMul = 0.5
    move.setDamage = "set"
    move.unlockLevel = 30
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
    move.unlockLevel = 40
    move.checkFail = function (b, p, t) {
        return p.damageBlockedInTurn > 0 || p.damageTakenInTurn > 0
    }
    move.getPower = (b, u, t) => {
        return Math.ceil(u.damageBlockedInTurn * 0.9 + u.damageTakenInTurn * 1.5)
    }
    move.selectDialogExtra = (b, p) => {
        let dmg = move.getPower(b, p, p)
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
}).setDesc(formatString("Deals damage to [a]all enemies[r] on the target's team, adding up to [a]90%[r] of the damage blocked by [a]Protect[r] + [a]150%[r] of the damage taken in the previous turn.\nThis move [f]cannot[r] [a]CRIT[r].")))
