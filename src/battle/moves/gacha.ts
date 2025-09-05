import { Battle, Player } from "../../battle"
import { StatusID } from "../../gen"
import { moves, Move } from "../../moves"
import { ffrac } from "../../number-format"
import { ExtendedStatID } from "../../stats"
import { weightedDistribution, formatString, weightedRandom } from "../../util"

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
            b.addMagic(p, e.amount)
            break
        case "charge":
            b.addCharge(p, e.amount)
            break
        case "absorption":
            b.logL("move.absorption", { player: p.toString() })
            p.addAbsorption({
                initialValue: Math.ceil(e.amount * p.cstats.hp),
                efficiency: 1
            })
            break
        case "heal":
            b.healO(p, Math.ceil(e.amount * p.cstats.hp), { inf })
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
moves.set("support_gacha", new Move("Support: Gacha", "status_buff", 0, "status").set(move => {
    move.requiresMagic = 5
    move.maxEnhance = 2
    move.unlockLevel = 40
    move.supportTargetting = true
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
        let pullCount = minRolls + Math.floor(b.rng.get01() * (maxRolls - minRolls - 1))
        for (let _ = 0; _ < pullCount; _++) {
            let pool = weightedRandom(gachaRarityPools.map(([a, b]) => [b, a] as const), b.rng.get01.bind(b.rng))
            let result = pool.pool[Math.floor(pool.pool.length * b.rng.get01())]
            b.logL("move.gacha", { rarity: pool.label, result: result.name })
            applyGachaEffect(b, t, result, u)
        }
    }
}))