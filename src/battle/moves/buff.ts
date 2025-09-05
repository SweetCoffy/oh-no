import { moves, Move, enhanceLevelDesc } from "../../moves"
import { ffrac } from "../../number-format"
import { formatString } from "../../util"

moves.set("stronk", new Move("Stronk", "status_buff", 0, "status").set(move => {
    move.targetStat.atk = 1
    move.supportTargetting = true
    move.unlockLevel = 25
}).setDesc(formatString("Increases the user's [a]ATK[r] by [a]1[r] stage.")))
moves.set("spstronk", new Move("Magik Sord", "status_buff", 0, "status").set(move => {
    move.targetStat.spatk = 1
    move.supportTargetting = true
    move.unlockLevel = 25
}).setDesc(formatString("Increases the user's [a]SPATK[r] by [a]1[r] stage.")))

moves.set("reckless_rush", new Move("Reckless Rush", "status_buff", 0, "status").set(move => {
    move.supportTargetting = true
    move.onlyTargetSelf = true
    move.requiresCharge = 20
    move.maxEnhance = 2
    move.unlockLevel = 30
    let baseDuration = 2
    move.onUse = (b, p, t, { enhance }) => {
        let s = b.inflictStatus(t, "rush", p)
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


moves.set("mind_overwork", new Move("Neuro-Overclock", "status_buff", 0, "status").set(move => {
    move.supportTargetting = true
    move.onlyTargetSelf = true
    move.requiresMagic = 25
    move.maxEnhance = 2
    move.unlockLevel = 30
    let baseDuration = 3
    move.onUse = (b, p, t, { enhance }) => {
        let s = t.status.find(v => v.type == "mind_overwork")
        if (s) {
            s.turnsLeft = s.duration
            let dmg = Math.min(Math.ceil(p.maxhp / 4), p.hp + p.plotArmor - 1)
            b.takeDamageO(p, dmg)
            return
        }
        s = b.inflictStatus(t, "mind_overwork", p)
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
moves.set("support_absorption", new Move("Iron Dome Defense System", "absorption", 90, "status", 100).set(move => {
    move.requiresMagic = 20
    move.supportTargetting = true
    move.maxEnhance = 4
    move.enhanceFactor = 0.5
    move.unlockLevel = 35
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
moves.set("support_advance", new Move("After Me", "status", 0, "status").set(move => {
    move.description = formatString("For the duration of the turn, makes the target's [a]Speed[r] equal to the user's.")
    move.unlockLevel = 20
    move.maxEnhance = 2
    move.getDescription = (el) => {
        let desc = move.description
        if (el >= 2) {
            desc += formatString(`${enhanceLevelDesc(2)}: Additionally increases [a]CRIT Rate[r] by [a]20%[r] and, if the target is an enemy, makes their action target the user instead.`)
        }
        return desc
    }
    move.onUse = function (b, p, t, { enhance }) {
        let speedDelta = p.cstats.spd - t.cstats.spd
        t.addModifier("spd", {
            label: "After Me",
            expires: 1,
            type: "add",
            value: speedDelta + 1
        })
        if (enhance >= 2) {
            t.addModifier("crit", {
                label: "After Me (E2)",
                expires: 1,
                type: "add",
                value: 20
            })
            if (b.isEnemy(p, t)) {
                t.forceTarget = p
            }
        }
    }
}))