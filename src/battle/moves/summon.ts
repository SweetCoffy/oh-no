import { Battle, Player } from "../../battle"
import { enemies } from "../../enemies"
import { getString } from "../../locale"
import { moves, Move, enhanceLevelDesc } from "../../moves"
import { fnum } from "../../number-format"
import { calcStats, StatID } from "../../stats"
import { formatString } from "../../util"

export function utilSummon(b: Battle, p: Player, summonType: string, levelFrac: number = 0.9, override: Partial<Player> = {}) {
    let found = p.findSummon(summonType)
    if (!found) {
        let s = p.createSummon(b, summonType, levelFrac, override)
        if (!s) b.logL("move.fail", {})
        return s
    }
    let healAmount = found.cstats.hp - found.hp
    b.healO(found, healAmount, { fixed: true })
    return found
}
export function summonOnUse(summonType: string, levelFrac: number = 0.9) {
    return function (b: Battle, p: Player, t: Player) {
        utilSummon(b, p, summonType, levelFrac)
    }
}
export function summonDesc(summonType: string, levelFrac: number = 0.9) {
    let testLevels = [50, 100]
    let e = enemies.get(summonType)
    if (!e) return ""
    let testStats = testLevels.map(level => calcStats(Math.ceil(level * levelFrac), e.stats))
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
    return formatString(`[a]${e.name}[r]:\n${e.description}\n${statsString}\nMoves: ${movesString}\nIf this move is used when the user has a [a]Summon[r] of the same type, that [a]Summon[r]'s [a]HP[r] is fully restored.`)
}
moves.set("summon_eh", new Move("Summon: Egg Hater", "summon", 0, "status").set(move => {
    move.requiresMagic = 30
    move.onUse = summonOnUse("egg_hater", 1.0)
    move.unlockLevel = 40
    queueMicrotask(() => {
        move.description = summonDesc("egg_hater")
    })
}))
moves.set("summon_u", new Move("Summon: ú", "summon", 0, "status").set(move => {
    move.requiresMagic = 40
    move.maxEnhance = 4
    let baseChgRegen = 20
    move.specialEnhance = [2]
    move.onUse = (b, u, t, { enhance }) => {
        let levelFrac = 0.5 + (enhance - 1) * 0.05
        let s = utilSummon(b, u, "u", levelFrac, { ability: enhance >= 2 ? "u_exclusive" : undefined })
        if (s) {
            s.movesetEnhance.pingcheck = enhance
            if (enhance >= 2) {
                let chg = baseChgRegen + (enhance - 2) * 5
                b.addCharge(s, chg)
            }
        }
    }
    move.unlockLevel = 45
    move.getDescription = (el) => {
        let chg = baseChgRegen + (el - 2) * 5
        let desc = summonDesc("u", 0.5 + (el - 1) * 0.05) +
        formatString(`\nú's exclusive move [a]Pingcheck[r] will match the [a]Enhancement Level[r] of its summoner's [a]Summon: ú[r].`)
        if (el >= 2) {
            desc += formatString(`\n${enhanceLevelDesc(2)}: ú gains its exclusive ability [a]Soul Conversion[r] and regenerates [a]${chg} Charge[r].`)
        }
        return desc
    }
}))