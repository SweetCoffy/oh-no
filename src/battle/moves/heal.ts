import { moves, Move, enhanceLevelDesc } from "../../moves"
import { ffrac } from "../../number-format"
import { formatString } from "../../util"

moves.set("regen", new Move("Regeneration", "heal", 0, "status", 100).set(move => {
    move.requiresMagic = 20
    move.supportTargetting = true
    move.unlockLevel = 50
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
moves.set("heal", new Move("Heal", "heal", 40, "status", 100).set(move => {
    move.requiresMagic = 30
    move.supportTargetting = true
    move.maxEnhance = 4
    move.enhanceFactor = 0.6
    move.onUseOverride = false
    move.specialEnhance = [4]
    move.unlockLevel = 45
    move.getDescription = (el) => {
        let pow = move.getBasePower(el)
        let desc = `Heals the target by [a]${ffrac(pow / 100)}[r] of the user's [a]Max HP[r].`
        if (el >= 4) {
            desc += `\n${enhanceLevelDesc(4)}: The target's [a]Max HP[r] is increased by [a]15%[r] of the user's [a]Max HP[r] for [a]4[r] turns.`
        }
        return formatString(desc)
    }
    move.description = move.getDescription(1)
    move.onUse = (b, u, t, { enhance }) => {
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
moves.set("revive", new Move("Revive", "heal", 100, "status").set(move => {
    move.accuracy = 100
    move.priority = 1
    move.setDamage = "set"
    move.supportTargetting = true
    move.requiresMagic = 50
    move.unlockLevel = 40
    move.checkFail = function (b, p, t) {
        return t.dead
    }
    move.onUse = function (b, p, t) {
        t.hp = 1
        b.healO(t, t.maxhp - 1, { fixed: true })
        b.logL("heal.revive", { player: t.toString() })
    }
}).setDesc(formatString("Revives the target with their full [a]HP[r] restored.")))
