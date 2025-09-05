import { moves, Move } from "../../moves"
import { formatString } from "../../util"

moves.set("needle", new Move("Needle", "attack", 5, "physical", 100).set(move => {
    move.inflictStatus.push({ status: "bleed", chance: 1 })
    move.setDamage = "percent"
    move.requiresCharge = 5
    move.unlockLevel = 20
}).setDesc(formatString("Deals [a]Physical[r] damage equal to [a]5%[r] of the target's [a]Max HP[r] and inflicts [a]Bleeding[r].")))
moves.set("twitter", new Move("Twitter", "status_debuff", 0, "status", 100).set(move => {
    move.inflictStatus.push({ chance: 1, status: "poison" })
    move.requiresMagic = 10
    move.unlockLevel = 30
    move.getAiAttackRank = (b, p, t) => {
        let s = t.status.find(v => v.type == "poison")
        if (s && s.turnsLeft > 1) return -1
        let dmg = p.cstats.spatk / 5 * 4
        return Math.min(t.hp / dmg, 1) * 100
    }
}).setDesc(formatString("Inflicts the target with [a]Poison[r]")))
