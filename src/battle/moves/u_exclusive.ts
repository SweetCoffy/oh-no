import { moves, Move, enhanceLevelDesc } from "../../moves"
import { ffrac } from "../../number-format"
import { formatString } from "../../util"

moves.set("pingcheck", new Move("Pingcheck", "attack", 0, "special", 100).set(move => {
    move.critMul = 0
    move.selectable = false
    move.recoil = 0.4
    move.requiresCharge = 20
    move.setDamage = "set"
    move.maxEnhance = 4
    move.enhanceFactor = 0.2
    move.getBasePower = (el = 1) => {
        return 40 * move.getEnhanceMult(el)
    }
    move.getPower = (b, u, t, enhance = 1) => {
        let bp = move.getBasePower(enhance)
        return u.cstats.hp * bp / 100
    }
    move.getDescription = (el) => {
        let pow = move.getBasePower(el)
        let mult = ffrac(pow / 100)
        let desc = `[a]ú[r]'s exclusive move that deals damage equal to [a]${mult}[r] of its [a]Max HP[r], while consuming [a]HP[r] equal to [a]${ffrac(move.recoil)}[r] of its [a]Max HP[r].`
        if (el >= 2) {
            desc += `\nThis move's [a]Enhancement Level[r] is reduced to [a]${el - 1}✦[r] after use.`
        } else {
            desc += `\n${enhanceLevelDesc(1)}: If ú is a [a]Summon[r], this move is removed from its move list after use.`
        }
        return formatString(desc)
    }
    move.onUse = (b, u, t, { enhance }) => {
        let pow = move.getPower(b, u, t, u.getEnhanceLevel(move.id))
        b.takeDamageO(t, pow, {
            atkLvl: u.level,
            defStat: "def",
            type: "physical"
        })
        if (u.summoner) {
            u.movesetEnhance.pingcheck = enhance - 1
            if (u.movesetEnhance.pingcheck < 1) {
                u.moveset = u.moveset.filter(m => m != "pingcheck")
            }
        }
    }
}))