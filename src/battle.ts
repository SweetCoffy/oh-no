import { EventEmitter } from "events"
import { User, Collection, AttachmentBuilder, SendableChannels, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"
import { setKeys, Dictionary, getID, formatString, getName, RNG } from "./util.js"
import { calcStats, Stats, baseStats, StatID, calcStat, ExtendedStatID, ExtendedStats, makeExtendedStats } from "./stats.js"
import { moves, Category } from "./moves.js"
import { BattleLobby } from "./lobby.js"
import { getString, LocaleString } from "./locale.js"
import { getUser } from "./users.js"
import { HeldItem, ItemClass, items } from "./helditem.js"
import { LogColor, LogColorWAccent } from "./ansi.js"
import { abilities } from "./abilities.js"
import { BotAI, BotAISettings } from "./battle-ai.js"
import { dispDelta, fnum } from "./number-format.js"
import { enemies } from "./enemies.js"

export const BASELINE_DEF = 100

export function calcDamage(dmg: number, def: number, level: number) {
    return dmg * getDamageDEFMul(def, level)
}
export function getDamageDEFMul(def: number, level: number) {
    let lf = calcStat(BASELINE_DEF, level)
    return lf / (lf + def)
}
export function calcMoveDamage(pow: number, atk: number, def: number, level: number) {
    return calcDamage((atk * pow / 100), def, level)
}
export interface CategoryStats {
    atk: ExtendedStatID,
    def: ExtendedStatID,
}
export const teamColors: LogColor[] = [
    "blue",
    "red",
    "yellow",
    "green",
    "pink",
]
export const teamEmojis = [
    "🟦",
    "🟥",
    "🟨",
    "🟩",
    "🟪",
]
export const teamNames = [
    "Blue",
    "Red",
    "Yellow",
    "Green",
    "Lean",
]
type GetRankingFn = (p: Player) => number
type GetWinnerFn = (b: Battle, ranking: GetRankingFn) => Player | number | undefined
type EndCondition = (b: Battle) => boolean
type OnStart = (b: Battle) => void
type TypeInfo = {
    name: string,
    teams: boolean,
    pve: boolean,
    turnLimit?: number,
    getWinner: GetWinnerFn,
    ranker: GetRankingFn,
    endCondition: EndCondition,
    onStart?: OnStart,
}
function teamRanking(team: Player[], ranking: GetRankingFn) {
    return team.reduce((prev, cur) => prev + ranking(cur), 0)
}
function ffaRanking(p: Player) {
    if (p.summoner) return 0
    return (p.hp + p.plotArmor) / (p.maxhp + p.plotArmor)
}
function sfRanking(p: Player) {
    if (p.summoner) return 0
    return p.damageDealt
}
function ffaGetWinner(b: Battle, ranking: GetRankingFn) {
    return b.players.filter(p => !p.summoner).sort((a, b) => ranking(b) - ranking(a))[0]
}
function ffaEndCondition(b: Battle) {
    let alivePlayers = b.players.filter(p => !p.dead && !p.summoner)
    return alivePlayers.length <= 1
}
function teamMatchEndCondition(b: Battle) {
    let teams = b.getTeams()
    let teamsLeft = teams.filter(t => t.some(p => !p.dead))
    return teamsLeft.length <= 1
}
function teamMatchGetWinner(b: Battle, ranking: GetRankingFn) {
    let teams = b.getTeams();
    return teams.sort((ta, tb) => teamRanking(tb, ranking) - teamRanking(ta, ranking))[0][0].team
}
function dummyEndCondition() {
    return false
}
function sfStart(b: Battle) {
    for (let player of b.players) {
        let baselineHp = calcStat(1000, player.level)
        let addAmount = baselineHp - player.maxhp
        player.addModifier("hp", {
            label: "Slap Fight",
            value: addAmount,
            type: "add",
        })
        player.plotArmor = player.maxhp
        player.hp = player.maxhp
    }
}
export const BattleTypeInfo: { [x in BattleType]: TypeInfo } = {
    "ffa": {
        name: "Free For All",
        teams: false,
        pve: false,
        getWinner: ffaGetWinner,
        ranker: ffaRanking,
        endCondition: ffaEndCondition,
    },
    "slap_fight": {
        name: "Slap Fight",
        teams: false,
        pve: false,
        turnLimit: 8,
        getWinner: ffaGetWinner,
        ranker: sfRanking,
        // Relies entirely on the turn limit
        endCondition: dummyEndCondition,
        onStart: sfStart,
    },
    "team_match": {
        name: "Team Match",
        teams: true,
        pve: false,
        getWinner: teamMatchGetWinner,
        ranker: ffaRanking,
        endCondition: teamMatchEndCondition,
    },
    "team_slap_fight": {
        name: "Team Slap Fight",
        teams: true,
        pve: false,
        turnLimit: 12,
        getWinner: teamMatchGetWinner,
        ranker: sfRanking,
        // Relies entirely on the turn limit
        endCondition: dummyEndCondition,
        onStart: sfStart,
    },
    "boss": {
        name: "Vs.Boss",
        teams: false,
        pve: true,
        getWinner: teamMatchGetWinner,
        ranker: ffaRanking,
        endCondition: teamMatchEndCondition,
    },
    "pve": {
        name: "Players Vs. Enemies",
        teams: false,
        pve: true,
        getWinner: teamMatchGetWinner,
        ranker: ffaRanking,
        endCondition: teamMatchEndCondition,
    },
} as const
export type BattleType = "boss" | "ffa" | "pve" | "slap_fight" | "team_match" | "team_slap_fight"
export const MinTeams = 2
export const MaxTeams = 5
export type BotAIType = "normal" | "egg_lord" | "the_cat" | "u";
export class StatusType<T = undefined> {
    name: string
    short: string
    duration = 4
    description: string = "N/A"
    upgradeTo?: string
    icon?: string
    negative: boolean = true
    fillStyle: string = "#ffffff"
    onStart?: typeof this.start
    onTurn?: typeof this.turn
    onEnd?: typeof this.end
    damageTakenModifierOrder = 0
    damageTakenModifier?:
        (b: Battle, p: Player, dmg: number, s: Status<T>, opts: TakeDamageOptions) => number;
    damageDealtModifierOrder = 0
    damageDealtModifier?:
        (b: Battle, p: Player, dmg: number, t: Player, s: Status<T>, opts: TakeDamageOptions) => number;
    start(b: Battle, p: Player, s: Status<T | undefined>) {
        if (this.onStart) this.onStart(b, p, s)
    }
    turn(b: Battle, p: Player, s: Status<T>) {
        if (this.onTurn) this.onTurn(b, p, s)
    }
    end(b: Battle, p: Player, s: Status<T>) {
        if (this.onEnd) this.onEnd(b, p, s)
    }
    constructor(name: string, short?: string, onStart?: typeof this.start, onTurn?: typeof this.turn, onEnd?: typeof this.end, upgradeTo?: string) {
        this.name = name
        this.short = short || name
        this.onStart = onStart
        this.onTurn = onTurn
        this.onEnd = onEnd
        this.upgradeTo = upgradeTo
    }
    set(func: (el: StatusType<T>) => any) {
        func(this)
        return this;
    }
}
type StatusCallback = (b: Battle, p: Player, s: Status) => any
function statusDamageEffect(percent: number, silent = false, message: LocaleString = "dmg.generic"): StatusCallback {
    return function (b, p, s) {
        b.takeDamage(p, p.maxhp * percent, silent, message)
    }
}
export function isDamageDirect(opts: TakeDamageOptions) {
    return opts.inflictor != null && (opts.type == "special" || opts.type == "physical" || opts.type == "none")
}
function statusMessageEffect(message: LocaleString): StatusCallback {
    return function (b, p, s) {
        b.log(getString(message, { player: p.toString(), inf: s.inflictor?.toString() }))
    }
}
export let statusTypes: Collection<string, StatusType<any>> = new Collection()
const STATUS_BASELINE_SPATK = 50
type BrokenStatusData = StatusModifierData;
statusTypes.set("broken", new StatusType<BrokenStatusData>("Broken", "Break", (b, p, s) => {
    let mods = [p.addModifier("def", {
        value: 0.1,
        type: "multiply",
        multCombine: "multiply",
        label: "Broken"
    }), p.addModifier("spdef", {
        value: 0.1,
        type: "multiply",
        multCombine: "multiply",
        label: "Broken"
    })]
    s.data = { mods }
}, undefined, (b, p, s) => {
    let d = s.data as BrokenStatusData
    for (let mod of d.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
}).set(s => {
    s.duration = 3
    s.fillStyle = "#656670"
    s.description = formatString("[a]DEF[r] and [a]Special DEF[r] decreased by [a]90%[r]")
}))
statusTypes.set("poison", new StatusType<StatusModifierData>("Poison", "Poison", (b, p, s) => {
    b.logL("status.poison.start", { player: p.toString() })
    s.data = {
        mods: [p.addModifier("spdef", {
            value: 0.6,
            multCombine: "multiply",
            type: "multiply",
            label: "Poison"
        }), p.addModifier("def", {
            value: 0.8,
            multCombine: "multiply",
            type: "multiply",
            label: "Poison"
        })]
    }
},
    function (b, p, s) {
        let base = s.infStats?.spatk ?? calcStat(STATUS_BASELINE_SPATK, p.level)
        let mult = 1.55 / 4
        if (b.type == "pve" && p.team == 0) {
            mult /= 2
        }
        b.takeDamageO(p, base * mult, {
            silent: false,
            message: "dmg.poison",
            inflictor: s.inflictor,
            type: "status",
            defStat: "spdef",
            atkLvl: s.inflictor?.level ?? p.level
        })
    }, (b, p, s) => {
        for (let mod of s.data.mods) {
            p.removeModifier(mod.stat, mod.id)
        }
    }).set(s => {
        s.description = formatString("Deals [a]DoT[r] equal to [a]38.75%[r] of inflictor's [a]Special ATK[r] (at the time of application) every turn and reduces [a]DEF[r]/[a]Special DEF[r] by [a]20%[r]/[a]40%[r].")
        s.fillStyle = "#c14dff"
        s.duration = 4
    }))
statusTypes.set("regen", new StatusType("Regeneration", "Regen", (b, p, s) => {
    statusTypes.get(s.type)?.onTurn?.(b, p, s)
}, function (b, p, s) {
    let base = s.infStats?.hp ?? p.maxhp
    let mult = 0.6 / 5
    b.healO(p, Math.ceil(base * mult), { message: "heal.regeneration", inf: s.inflictor })
}, undefined).set(s => {
    s.description = formatString("Heals for [a]12%[r] of the inflictor's [a]MAX HP[r] (at the time of application) every turn")
    s.fillStyle = "#68ff4d"
    s.duration = 5
}))
type DelayedPainData = { damage: number };
statusTypes.set("delayed_pain", new StatusType<DelayedPainData>("Delayed Pain", "D. Pain", (b, p, s) => {
    s.data = { damage: 0 }
}).set(e => {
    e.end = (b, p, s) => {
        b.takeDamageO(p, s.data.damage, {
            type: "none",
            breakshield: true
        })
    }
    e.damageTakenModifier = (b, p, d, s) => {
        s.data.damage += d
        return 0
    }
    e.description = formatString("Becomes [a]completely invulnerable[r] for the duration of the effect. However, [a]all would-be damage taken[r] is accumulated and is dealt [a]all at once[r] when the effect ends.")
    e.fillStyle = "#fff64d"
}))
statusTypes.set("bleed", new StatusType<StatusModifierData>("Bleeding", "Bleed", (b, p, s) => {
    b.logL("status.bleed.start", { player: p.toString() })
    s.data = {
        mods: [p.addModifier("def", {
            value: 0.7,
            multCombine: "multiply",
            type: "multiply",
            label: "Bleeding"
        }), p.addModifier("spdef", {
            value: 0.9,
            multCombine: "multiply",
            type: "multiply",
            label: "Bleeding"
        }), p.addModifier("inheal", {
            label: "Bleeding",
            value: -9999,
            type: "add",
        })]
    }
}, (b, p, s) => {
    let base = s.infStats?.atk ?? calcStat(STATUS_BASELINE_SPATK, p.level)
    let mult = 1.1 / 4
    b.takeDamageO(p, base * mult, {
        silent: false,
        inflictor: s.inflictor,
        message: "dmg.bleed",
        type: "status",
        defStat: "def",
        atkLvl: s.inflictor?.level ?? p.level
    })
}, (b, p, s) => {
    for (let mod of s.data.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
}).set(s => {
    s.description = formatString("Deals [a]DoT[r] equal to [a]27.5%[r] of inflictor's [a]ATK[r] (at the time of application) every turn, reduces [a]DEF[r]/[a]Special DEF[r] by [a]30%[r]/[a]10%[r] and [a]disables healing[r].")
    s.fillStyle = "#ff4d74"
    s.duration = 4
}))
type StatusModifierData = {
    mods: (StatModifier & { id: string, stat: ExtendedStatID })[]
}
let rush = new StatusType<StatusModifierData>("Reckless Rush", "Rush", (b, p, s) => {
    let rsource = s.inflictor ?? p
    let charge = rsource.charge
    rsource.charge = 0
    let mods = []
    let modValue = 1 + Math.min((charge + 20) / 100, 1)
    mods.push(p.addModifier("atk", {
        label: "Reckless Rush",
        type: "multiply",
        value: modValue,
    }))
    let data: StatusModifierData = { mods }
    s.data = data
    b.logL("status.rush.start", { player: p.toString() })
}, undefined, (b, p, s) => {
    let data = s.data
    for (let mod of data.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
}).set(s => {
    s.description = formatString("[a]ATK[r] is greatly boosted")
    s.fillStyle = "#ff774d"
})
let overclock = new StatusType<StatusModifierData>("Overclock", "Overclock", (b, p, s) => {
    let rsource = s.inflictor ?? p
    let magic = rsource.magic
    rsource.magic = 0
    p.magic = p.maxMagic
    let mods = []
    let modValue = 1 + Math.min((magic + 25) / 200, 1)
    mods.push(p.addModifier("spatk", {
        label: "Overclock",
        type: "multiply",
        value: modValue,
    }))
    let data: StatusModifierData = { mods }
    s.data = data
    b.logL("status.overclock.start", { player: p.toString() })
}, (b, p, s) => {
    p.magic = p.maxMagic
}, (b, p, s) => {
    let data = s.data
    for (let mod of data.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
    p.magic = 0
}).set(s => {
    s.description = formatString("[a]Special ATK[r] is boosted and [a]Magic[r] is fully regenerated every turn.")
    s.fillStyle = "#4d9dff"
})
let healthBoost = new StatusType<StatusModifierData>("Health Boost", "HP Boost", (b, p, s) => {
    let mods = []
    let base = (s.infStats?.hp ?? p.cstats.hp)
    if (p == s.inflictor) {
        base = p.stats.hp
    }
    let modValue = base * 0.15
    let oldMax = p.cstats.hp
    mods.push(p.addModifier("hp", {
        label: "Health Boost",
        type: "add",
        value: modValue,
    }))
    let delta = p.cstats.hp - oldMax
    b.healO(p, delta, { fixed: true })
    let data: StatusModifierData = { mods }
    s.data = data
}, undefined, (b, p, s) => {
    let data = s.data
    for (let mod of data.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
}).set(s => {
    s.description = formatString("[a]Max HP[r] is increased.")
    s.fillStyle = "#68ff4d"
    s.duration = 5
})
statusTypes.set("health_boost", healthBoost)
statusTypes.set("rush", rush)
statusTypes.set("mind_overwork", overclock)
let categories: { [key: string]: CategoryStats } = {
    "physical": {
        atk: "atk",
        def: "def"
    },
    "special": {
        atk: "spatk",
        def: "spdef"
    }
}
let curnum = 0
export const MAX_STAT_STAGES = 12
export function calcMul(stages: number) {
    if (stages > 0) return Math.min(1 + (stages / MAX_STAT_STAGES * 3), 4)
    if (stages < 0) return Math.max(1 / (stages / MAX_STAT_STAGES * 4), 0.25)
    return 1
}
export function getDEF(player: Player, category: Category): number {
    return player.cstats[categories[category].def] ?? 0
}
export function getATK(player: Player, category: Category): number {
    return player.cstats[categories[category].atk] ?? 0
}
export interface Status<T = object | undefined> {
    duration: number,
    turns: number,
    turnsLeft: number,
    inflictor?: Player,
    infStats?: ExtendedStats
    type: string,
    data: T,
}
export interface StatModifier {
    type?: "add" | "multiply",
    multCombine?: "add" | "multiply",
    value: number,
    expires?: number,
    disabled?: boolean,
    label?: string,
}
export type DamageTakenModifier = {
    order: number,
    func: (b: Battle, player: Player, damage: number, opts: TakeDamageOptions) => number,
}
export type DamageDealtModifier = {
    order: number,
    func: (b: Battle, player: Player, damage: number, target: Player, opts: TakeDamageOptions) => number,
}
export type StatModifierWithID = StatModifier & { id: string }
const defaultDamageTakenModifiers: DamageTakenModifier[] = [
    {
        order: -5,
        func(b, p, dmg, opts) {
            return dmg * Math.max(1 - p.cstats.dr / 100, 0)
        }
    },
    {
        order: -4,
        func(b, p, dmg, opts) {
            if (!opts.defStat) return dmg
            if (!opts.atkLvl) return dmg
            let def = p.cstats[opts.defStat]
            let lvl = opts.atkLvl
            let defMul = getDamageDEFMul(def, lvl)
            let totalReduced = dmg * (1 - defMul)
            return dmg * defMul
        }
    },
    {
        order: -3,
        func(b, p, dmg, opts) {
            if (!p.protect)
                return dmg
            let def = 0
            if (opts.type == "physical")
                def = p.cstats.def
            if (opts.type == "special")
                def = p.cstats.spdef
            let block = Math.min(dmg * 0.5 + def, dmg)
            if (opts.breakshield) {
                b.logL("dmg.breakthrough", { player: p.toString() })
                block *= 0.5
            }
            b.logL("dmg.block", { player: p.toString(), damage: Math.floor(block) })
            p.damageBlocked += block
            p.damageBlockedInTurn += block
            dmg -= block
            if (dmg <= 0) {
                opts.silent = true
            }
            return dmg
        }
    },
    {
        order: -1,
        func(b, p, dmg, opts) {
            if (opts.bypassAbsorb) return dmg
            dmg = Math.ceil(dmg)
            let initial = dmg
            dmg = p.subAbsorptionAll(dmg, b)
            let absorbed = initial - dmg
            if (absorbed > 0) {
                b.logL("dmg.absorb", { player: p.toString(), damage: fnum(absorbed) })
            }
            if (dmg <= 0) {
                opts.silent = true
            }
            return dmg
        }
    },
]
const defaultDamageDealtModifiers: DamageDealtModifier[] = []
const defaultStats: ExtendedStats = {
    hp: 0,
    atk: 0,
    def: 0,
    spatk: 0,
    spdef: 0,
    spd: 0,
    dr: 0,
    chgbuildup: 100,
    magbuildup: 100,
    chglimit: 50,
    maglimit: 50,
    crit: 10,
    critdmg: 50,
    inheal: 100,
    outheal: 100,
}
export type AbsorptionMod = {
    initialValue: number,
    efficiency: number,
    dmgRedirect?: Player,
    dmgRedirectFrac?: number,
}
export type AbsorptionModWithID = AbsorptionMod & { id: string, value: number, active: boolean, dmg: number, dmgRedirectFrac: number }
/**
 * Represents an in-battle player
 */
export class Player<AbilityData extends {} = {}> {
    /** The player's current HP */
    hp: number = 0
    prevHp: number = 0
    healingInTurn: number = 0
    prevAbsorption: number = 0
    /** The player's Max HP */
    get maxhp() {
        return this.cstats.hp;
    }
    forceTarget?: Player
    summonId: string = ""
    /** HP can reach up to`overheal` × `maxhp` */
    overheal: number = 1
    /** The total damage taken in the battle */
    damageTaken: number = 0
    /** The total damage blocked by Protect in battle */
    damageBlocked: number = 0
    /** The total damage dealt in battle */
    damageDealt: number = 0
    /** The total number of kills done in battle */
    kills: number = 0
    /** The current level, used for stat and damage calculations */
    level: number = 1
    /** How many times has Protect been used in a row, used to lower success rate */
    protectTurns: number = 0
    /** Whether or not the player is protecting */
    protect: boolean = false
    /** The damage blocked in the previous turn, used for Counter */
    damageBlockedInTurn: number = 0
    damageTakenInTurn: number = 0
    /** The type of Bruh Orb the player has activated */
    bruh?: string = undefined
    /** The team the player belongs to */
    team: number = 0
    /** The amount of absorption health the player has */
    // not anymore lollolololo
    //absorption: number = 0
    private _charge: number = 0
    private _magic: number = 0
    isBot() {
        if (this.user) return false
        if (this.summoner && !this.summoner.isBot()) {
            return false
        }
        return true
    }
    get maxMagic() {
        return this.cstats.maglimit
    }
    get maxCharge() {
        return this.cstats.chglimit
    }
    /** How far into the negatives the player's health can go before dying, used by the Plot Armor ability */
    plotArmor: number = 0
    positionInTurn: number = 9999
    /** The list of usable moves for the player, only used for user-controlled players */
    moveset: string[] = ["bonk", "nerf_gun", "stronk", "spstronk"]
    movesetEnhance: Dictionary<number>
    absorptionMods: AbsorptionModWithID[]
    modifiers: { [x in ExtendedStatID]: (StatModifier & { id: string })[] } = {
        hp: [],
        atk: [],
        def: [],
        spatk: [],
        spdef: [],
        spd: [],
        chgbuildup: [],
        magbuildup: [],
        chglimit: [],
        maglimit: [],
        dr: [],
        crit: [],
        critdmg: [],
        inheal: [],
        outheal: [],
    }
    abilityData!: AbilityData
    ability?: string
    summoner?: Player
    summons: Player[]
    summonCap: number = 1
    cleanupSummons() {
        this.summons = this.summons.filter(v => !v.dead)
    }
    findSummon(preset: string): Player | null {
        let found = this.summons.find(s => s.summonId == preset)
        if (found) return found
        return null
    }
    createSummon(b: Battle, preset: string, levelFrac: number = 0.9, override: Partial<Player> = {}): Player | null {
        this.cleanupSummons()
        if (this.summons.length >= this.summonCap) {
            return null
        }
        if (b.players.length + 1 > 25) {
            return null
        }
        let e = enemies.get(preset)
        if (!e) {
            return null
        }
        let p = new Player()
        p._nickname = `${this.name}'s ${e.name}`
        p.baseStats = { ...e.stats }
        p.moveset = [...e.moveset]
        p.ability = e.ability
        p.level = Math.ceil(this.level * levelFrac)
        p.team = this.team
        p.summonId = preset
        p.summoner = this
        for (let k in override) {
            //@ts-ignore
            p[k] = override[k]
        }
        this.summons.push(p)
        p.aiState = new BotAI(b, p)
        b.players.push(p)
        p.updateStats()
        p.prevHp = p.hp
        p.initAbility(b)
        return p
    }
    toString() {
        return `[${teamColors[this.team] || "a"}]${this.name}[r]`
    }
    getDamageTakenModifiers(): DamageTakenModifier[] {
        let mods = [...defaultDamageTakenModifiers]
        let ab = abilities.get(this.ability ?? "")
        if (ab) {
            mods.push({
                order: ab.damageTakenModifierOrder,
                func: (b, p, dmg, opts) => {
                    let override = ab.damage(b, p, dmg, opts.inflictor, opts)
                    return override ?? dmg
                }
            })
        }
        for (let status of this.status) {
            let type = statusTypes.get(status.type)
            if (!type) continue
            if (status.turnsLeft <= 0) continue
            let fn = type.damageTakenModifier
            if (!fn) continue
            mods.push({
                order: type.damageTakenModifierOrder,
                func: (b, p, dmg, opts) => {
                    return fn(b, p, dmg, status, opts)
                }
            })
        }
        let defenseItem = this.itemSlots.defense
        if (defenseItem) {
            let item = items.get(defenseItem.id)
            if (item?.onDamage) {
                let onDamage = item.onDamage
                mods.push({
                    order: item.damageTakenModifierOrder,
                    func: (b, p, dmg, opts) => {
                        let override = onDamage(b, p, defenseItem, dmg, opts)
                        return override ?? dmg
                    }
                })
            }
        }
        return mods
    }
    getDamageDealtModifiers(): DamageDealtModifier[] {
        let mods = [...defaultDamageDealtModifiers]
        let ab = abilities.get(this.ability ?? "")
        if (ab) {
            mods.push({
                order: ab.damageDealtModifierOrder,
                func: (b, p, dmg, target, opts) => {
                    let override = ab.damageDealt(b, p, dmg, target, opts)
                    return override ?? dmg
                }
            })
        }
        for (let status of this.status) {
            let type = statusTypes.get(status.type)
            if (!type) continue
            let fn = type.damageDealtModifier
            if (!fn) continue
            if (status.turnsLeft <= 0) continue
            mods.push({
                order: type.damageDealtModifierOrder,
                func: (b, p, dmg, target, opts) => {
                    return fn(b, p, dmg, target, status, opts)
                }
            })
        }
        let offenseItem = this.itemSlots.offense
        if (offenseItem) {
            let item = items.get(offenseItem.id)
            if (item?.onDamageDealt) {
                let damageDealt = item.onDamageDealt
                mods.push({
                    order: item.damageDealtModifierOrder,
                    func: (b, p, dmg, target, opts) => {
                        let override = damageDealt(b, p, offenseItem, dmg, target, opts)
                        return override ?? dmg
                    }
                })
            }
        }
        return mods
    }
    getModifierValue(value: number, mods: StatModifierWithID[], exclude: string[] = []) {
        let addAccumulator = 0
        let multAccumulator = 1
        let multAddAccumulator = 0
        for (let mod of mods) {
            if (mod.disabled) continue;
            if (exclude.includes(mod.id)) continue;
            if (mod.type == "add") addAccumulator += mod.value;
            else {
                if (mod.multCombine == "add") {
                    multAddAccumulator += mod.value - 1
                } else {
                    multAccumulator *= mod.value
                }
            }
        }
        return Math.max(((value + value * multAddAccumulator) * multAccumulator) + addAccumulator, 0)
    }
    addModifier(stat: ExtendedStatID, mod: StatModifier) {
        let id = getID();
        let e = {
            ...mod,
            id,
            stat,
        }
        this.modifiers[stat].push(e);
        this.modifiers[stat].sort((a, b) => a.value - b.value).sort((a, b) => {
            if (a.type == b.type) return 0;
            if (a.type == "add") return -1;
            if (b.type == "add") return 1;
            return 0;
        })
        this.recalculateStats()
        return e;
    }
    removeModifier(stat: ExtendedStatID, id: string) {
        let i = this.modifiers[stat].findIndex(el => el.id == id)
        if (i == -1) return
        this.modifiers[stat].splice(i, 1)
        this.recalculateStats()
    }
    getModifier(stat: ExtendedStatID, id: string) {
        return this.modifiers[stat].find(el => el.id == id);
    }
    get charge(): number {
        return Math.min(Math.max(this._charge, 0), this.maxCharge)
    }
    get magic(): number {
        return Math.min(Math.max(this._magic, 0), this.maxMagic)
    }
    set charge(v: number) {
        this._charge = v
    }
    set magic(v: number) {
        this._magic = v
    }
    get dead() {
        return this.hp <= -this.plotArmor
    }
    vaporized: boolean = false
    /** The player's true (unmodified) stats */
    stats: ExtendedStats = makeExtendedStats()
    /** The player's base stats, usually taken from their preset */
    baseStats: Stats = { ...baseStats }
    /** The Discord user the player belongs to, used to get the current name and other stuff that needs a Discord user */
    user?: User
    /** The player's status conditions */
    status: Status[] = []
    /** The player's stat modifiers */
    statStages: ExtendedStats = makeExtendedStats()
    private statStageModifiers: { [x in ExtendedStatID]: StatModifier }
    /** The ID of the player */
    id: string
    /** The player's current held items */
    helditems: HeldItem[] = []
    itemSlots: { [x in ItemClass]?: HeldItem } = {}
    aiSettings: BotAISettings = {}
    aiState!: BotAI
    /** The base XP yield, only used in hunt */
    xpYield: number = 0

    // for compatibility
    // get atk() { return this.cstats.atk }
    // get def() { return this.cstats.def }
    // get spatk() { return this.cstats.spatk }
    // get spdef() { return this.cstats.spdef }
    // get spd() { return this.cstats.spd }
    // get dr() { return this.cstats.dr }

    cstats: ExtendedStats = {
        ...makeExtendedStats(),
    }

    _tempname = ""
    get name() {
        if (this._nickname) return this._nickname
        if (this.user) return this.user.displayName
        return this._tempname
    }
    set name(v: string) {
        this._nickname = v
    }
    /**
     * The "nickname" of the player, used to properly name enemies in /hunt
     */
    _nickname = ""
    /**
     * A list of player events for each turn
     */
    events: PlayerEvent[][] = []
    critMod: StatModifierWithID
    getEnhanceLevel(move: string) {
        return this.movesetEnhance[move] ?? 1
    }
    addEvent(event: PlayerEvent, turn: number) {
        if (!(turn in this.events)) this.events[turn] = []
        this.events[turn].push(event)
    }
    getFinalStats(): ExtendedStats {
        return {
            ...this.cstats
        }
    }
    recalculateStats() {
        setKeys(this.stats, this.cstats)
        for (let k in this.stats) {
            let stat = k as ExtendedStatID
            this.cstats[stat] = this.getModifierValue(this.stats[stat], this.modifiers[stat])
        }
        this.cstats.hp = Math.ceil(Math.max(this.cstats.hp, 1))
        this.cstats.dr = Math.min(this.cstats.dr, 99)
        if (this.critMod != null) {
            this.critMod.value = this.cstats.spd / this.stats.spd
        }
        this.cstats.crit = this.getModifierValue(this.stats.crit, this.modifiers.crit)
    }
    /**
     * Updates the player's current stats to match what they should be according to level and base stats
     * @param updateHp Whether or not to increase or decrease current HP if Max HP is different
     */
    updateStats(updateHp: boolean = true) {
        let lastHpFrac = this.hp / this.maxhp
        setKeys(defaultStats, this.stats)
        let resourceBaseline = calcStat(100, this.level)
        setKeys(calcStats(this.level, this.baseStats), this.stats)
        this.stats.chglimit = Math.ceil(Math.max(40 + (this.stats.atk + this.stats.def * 0.76) / resourceBaseline * 40, 60) / 5) * 5
        this.stats.maglimit = Math.ceil(Math.max(40 + (this.stats.spatk + this.stats.spdef * 0.76) / resourceBaseline * 40, 60) / 5) * 5
        this.stats.crit = Math.min(Math.ceil(this.stats.spd / resourceBaseline * 10), 100)
        this.recalculateStats()
        this.cstats.crit = Math.min(this.cstats.crit, 200)
        if (updateHp) this.hp = Math.floor(lastHpFrac * this.maxhp)
    }
    updateStatStages() {
        for (let k in this.statStages) {
            let mod = this.statStageModifiers[k as StatID]
            let stages = this.statStages[k as StatID]
            mod.label = `Stage Modifier (${dispDelta(stages)})`
            mod.value = calcMul(stages)
        }
        this.recalculateStats()
    }
    updateItems() {
        for (let k in this.itemSlots) {
            this.itemSlots[k as ItemClass] = undefined
        }
        for (let item of this.helditems) {
            let itemType = items.get(item.id)
            if (!itemType) continue
            if (item.remove) continue
            if (itemType.class != "passive") {
                if (!this.itemSlots[itemType.class]) this.itemSlots[itemType.class] = item
                else {
                    item.remove = true
                }
            }
        }
        this.helditems = this.helditems.filter(el => !el.remove)
    }
    addAbsorption(a: AbsorptionMod): AbsorptionModWithID {
        let id = getID()
        let mod: AbsorptionModWithID = {
            id,
            initialValue: a.initialValue,
            value: a.initialValue,
            efficiency: a.efficiency,
            dmg: 0,
            active: true,
            dmgRedirectFrac: a.dmgRedirectFrac ?? 1,
            dmgRedirect: a.dmgRedirect,
        }
        this.absorptionMods.push(mod)
        this.absorptionMods.sort((a, b) => b.efficiency - a.efficiency)
        this.prevAbsorption = this.getTotalAbsorption()
        return mod
    }
    subAbsorption(mod: AbsorptionModWithID, amt: number, b: Battle): number {
        let v = Math.min(Math.ceil(mod.value * mod.efficiency), amt)
        mod.value -= v
        mod.dmg += v
        let leftover = amt - v
        let lvl = this.level
        if (mod.dmgRedirect) {
            let d = v * mod.dmgRedirectFrac
            let mmult = mod.dmgRedirect.cstats.magbuildup / 100
            b.addMagic(mod.dmgRedirect, 50 * d / mod.dmgRedirect.cstats.hp, true)
            b.takeDamageO(mod.dmgRedirect, d, {
                type: "special",
                atkLvl: lvl,
                defStat: "spdef",
                bypassAbsorb: true
            })
        }
        if (mod.value <= 0) {
            mod.active = false
        }
        return leftover
    }
    subAbsorptionAll(amt: number, b: Battle): number {
        let leftover = amt
        for (let mod of this.absorptionMods) {
            if (leftover <= 0) break
            if (!mod.active) continue
            leftover = this.subAbsorption(mod, leftover, b)
        }
        return leftover
    }
    getTotalAbsorption(): number {
        return this.absorptionMods.filter(v => v.active).reduce((prev, cur) => prev + cur.value, 0)
    }
    getTotalMaxAbsorption(): number {
        return this.absorptionMods.filter(v => v.active).reduce((prev, cur) => prev + cur.initialValue, 0)
    }
    initAbility(b: Battle) {
        if (!this.ability) {
            return
        }
        let a = abilities.get(this.ability)!
        a.init(b, this)
    }
    constructor(user?: User) {
        this.summons = []
        this.movesetEnhance = {}
        this.absorptionMods = []
        if (user) {
            this.user = user
            this.baseStats = { ...getUser(user).baseStats }
        }
        this.id = Bun.randomUUIDv7()
        this.stats = makeExtendedStats()
        let stageModifiers = {}
        for (let k in this.statStages) {
            //@ts-ignore
            stageModifiers[k] = this.addModifier(k, {
                label: "Stage Modifier",
                type: "multiply",
                multCombine: "add",
                value: 0,
            })
        }
        this.critMod = this.addModifier("crit", {
            type: "multiply",
            value: 1,
            label: "Speed Modifier"
        })
        //@ts-ignore
        this.statStageModifiers = stageModifiers

        this.updateStats()
        this.updateStatStages()
        this.hp = this.maxhp
        this.prevHp = this.hp
        this._tempname = getName()
    }
    //[key: string]: any
}
export type ActionType = "move" | "item"
export interface BaseAction {
    player: Player,
}
export interface MoveAction {
    type: "move",
    move: string,
    target: Player,
}
export interface ItemAction {
    type: "item",
    item: string,
}
export type TurnAction = BaseAction & (MoveAction | ItemAction)
export function getPriority(action: TurnAction) {
    if (action.type == "move") {
        return moves.get(action.move)?.priority || 0
    } else if (action.type == "item") return 4
    return 0
}
type MovePlayerEvent = { type: "move", move: string, target: Player, failed: boolean }
type HealPlayerEvent = { type: "heal", amount: number }
type DamagePlayerEvent = { type: "damage", amount: number, inflictor?: Player }
type BasePlayerEvent = { type: string }
type PlayerEvent = HealPlayerEvent | DamagePlayerEvent | MovePlayerEvent
export type MoveCastOpts = {
    category: Category,
    requiresCharge: number,
    requiresMagic: number,
    accuracy: number,
    pow: number,
    critMul: number,
    multihit: number,
    enhance: number,
}
export type TakeDamageType = "none" | Category | "ability"
export interface TakeDamageOptions {
    silent?: boolean,
    message?: LocaleString,
    inflictor?: Player,
    breakshield?: boolean,
    type?: TakeDamageType,
    defStat?: ExtendedStatID,
    defPen?: number
    atkLvl?: number,
    bypassAbsorb?: boolean
}
export function isTeamMatch(type: BattleType) {
    return type == "team_match" || type == "team_slap_fight"
}
export class Battle extends EventEmitter {
    players: Player[] = []
    lobby: BattleLobby
    turn: number = 0
    actions: TurnAction[] = []
    logs: string[] = []
    rng: RNG
    ended: boolean = false
    sortPlayers() {
        //this.players = this.players.filter(p => !p.summoner || !p.dead)
        let nonSummons = this.players.filter(p => !p.summoner)
        nonSummons.sort((a, b) => a.team - b.team)
        let sorted: Player[] = []
        for (let player of nonSummons) {
            sorted.push(player)
            sorted.push(...player.summons)
        }
        this.players = sorted
    }
    start() {
        this.sortPlayers()
        for (let p of this.players) {
            p.helditems = [...new Set(p.helditems.map(el => el.id))].map(el => ({ id: el }))
            p.updateItems()
            for (let item of p.helditems) {
                let itemType = items.get(item.id)
                if (!itemType) continue
                itemType.onBattleStart?.(this, p, item)
            }
            p.aiState = new BotAI(this, p, p.aiSettings)
            p.prevHp = p.hp
            p.charge = 20
            p.magic = 30
            p.initAbility(this)
        }
        let start = BattleTypeInfo[this.type].onStart
        if (start) start(this)
    }
    isTeamMatch() {
        return isTeamMatch(this.type)
    }
    isEnemy(player: Player, target: Player) {
        if (player.summoner == target || target.summoner == player) return false
        if (player == target) return false
        if (!this.hasTeams) return true
        return player.team != target.team
    }
    lastImg?: Buffer
    async infoMessage(channel: SendableChannels) {
        let b = this
        let canvas_threads = await import("./canvas_threads.js")
        let img = this.lastImg ? this.lastImg : (this.lastImg = await canvas_threads.generateImage(this))
        let files = [
            new AttachmentBuilder(img, { name: "h.png" })
        ]
        let summaryEmbed = {
            title: "Summary",
            image: {
                url: "attachment://h.png",
            }
        }
        let msg = await channel.send({
            files,
            content: this.players.filter(v => !v.dead && v.user).map(v => v.user?.toString()).join(" "),
            embeds: [
                {

                    title: "Log",
                    description: "```ansi" + "\n" + b.logs.slice(-60).join("\n").slice(-3800) + "\n```"
                },
                summaryEmbed,
            ],
            //files: [new AttachmentBuilder(Buffer.from(b.logs.join("\n"))).setName("log.ansi")],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .setComponents(
                        new ButtonBuilder()
                            .setLabel("Attack")
                            .setEmoji("⚔️")
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId("choose:open_selector"),
                        new ButtonBuilder()
                            .setLabel("View Info")
                            .setEmoji("ℹ️")
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId("info:open_selector")
                    )
            ]
        })
        return msg
    }
    type: BattleType
    constructor(lobby: BattleLobby) {
        super()
        this.rng = new RNG()
        this.lobby = lobby
        this.type = lobby.type
        this.turnLimit = BattleTypeInfo[this.type].turnLimit ?? 50
    }
    /**
     * Increases `player`'s `stat` stages by `stages` and shows the respective message if `silent` is false
     */
    statBoost(player: Player, stat: ExtendedStatID, stages: number, silent = false) {
        if (stages == 0) return
        if (!silent && stat == "atk" && stages > 0) {
            this.addCharge(player, stages * 5)
        }
        player.statStages[stat] += stages;
        if (silent) return
        if (stages > 0) {
            if (stages > 2) {
                this.log(getString("stat.change.rose.drastically", { player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "green")
            } else if (stages > 1) {
                this.log(getString("stat.change.rose.sharply", { player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "green")
            } else {
                this.log(getString("stat.change.rose", { player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }))
            }
        } else if (stages < 0) {
            if (stages < -2) {
                this.log(getString("stat.change.fell.severely", { player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "red")
            } else if (stages < -1) {
                this.log(getString("stat.change.fell.harshly", { player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "red")
            } else {
                this.log(getString("stat.change.fell", { player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }))
            }
        }
        player.updateStatStages()
    }
    /**
     * Increases `player`'s statStages by the stages set in `stats` and shows the respective messages if `silent` is false
     */
    multiStatBoost(player: Player, stats: { [x in ExtendedStatID]?: number }, silent: boolean = false) {
        for (let k in stats) {
            this.statBoost(player, k as StatID, stats[k as StatID] as number, silent)
        }
    }
    fullLog: string[] = []
    logIndent: number = 0
    log(str: string, color: LogColorWAccent = "white") {
        this.fullLog.push(str)
        this.logs.push(" ".repeat(this.logIndent) + formatString(str, color))
        this.emit("log", str)
    }
    logL(str: LocaleString, vars: Dictionary<any> | any[], color: LogColorWAccent = "white") {
        this.log(getString(str, vars), color)
    }
    sortActions() {
        return this.actions.sort((a, b) => b.player.stats.spd - a.player.stats.spd).sort((a, b) => getPriority(b) - getPriority(a))
    }
    checkActions() {
        for (let p of this.players) {
            if (p.isBot()) {
                this.addAction({
                    type: "move",
                    player: p,
                    ...p.aiState.getAction()
                })
            }
        }
        let a = this.actions
        if (this.players.filter(el => !el.dead).every(pl => a.some(el => el.player.id == pl.id))) {
            this.sortActions()
            this.doActions()
            return true
        } else return false
    }
    takeDamage(user: Player, damage: number, silent: boolean = false, message: LocaleString = "dmg.generic", breakshield: boolean = false, inflictor?: Player, opts: TakeDamageOptions = {}) {
        this.takeDamageO(user, damage, {
            ...opts,
            silent,
            inflictor,
            breakshield,
            message,
        })
    }
    takeDamageO(target: Player, dmg: number, opts: TakeDamageOptions = {}) {
        if (target.dead) {
            if (!opts.silent) this.logL("dmg.dead", { player: target.toString() }, "gray")
            return
        }
        let prevIndent = this.logIndent
        let prevHp = target.hp
        let targetDmgMods = target.getDamageTakenModifiers()
        let infDmgMods: DamageDealtModifier[] = []
        if (opts.inflictor) {
            infDmgMods = opts.inflictor.getDamageDealtModifiers()
            infDmgMods.sort((a, b) => a.order - b.order)
            for (let mod of infDmgMods) {
                dmg = mod.func(this, opts.inflictor, dmg, target, opts)
            }
        }
        targetDmgMods.sort((a, b) => a.order - b.order)
        for (let mod of targetDmgMods) {
            dmg = mod.func(this, target, dmg, opts)
        }
        dmg = Math.ceil(dmg)
        if (dmg <= 0) {
            if (!opts.silent) this.logL("dmg.none", { player: target.toString(), damage: Math.floor(dmg) }, "gray")
            return
        }
        target.hp -= dmg
        target.damageTakenInTurn += dmg
        this.logL(opts.message ?? "dmg.generic", { player: target.toString(), damage: Math.floor(dmg), Inf: opts.inflictor?.toString?.() ?? "unknown" }, "red")
        if (target.hp <= -target.plotArmor) {
            let deathMsg = "dmg.death"
            target.vaporized = false
            if (target.hp < -target.plotArmor - target.maxhp) {
                deathMsg = "dmg.overkill"
                target.vaporized = true
            }
            if (opts.inflictor) {
                deathMsg += ".player"
            }
            this.logIndent++
            this.logL(deathMsg as LocaleString, { player: target.toString(), Inf: opts.inflictor?.toString?.() ?? "unknown" }, "red")
            target.hp = -target.plotArmor
            if (target.summoner) {
                target.summoner.cleanupSummons()
            }
            for (let summon of target.summons) {
                summon.hp = -summon.plotArmor
            }
            this.logIndent = prevIndent
            target.cleanupSummons()
            return
        }
        if (target.hp <= 0 && prevHp > 0) {
            this.logL("dmg.plotarmor", { player: target.toString() })
        }
    }
    healO(user: Player, amount: number, opts: { silent?: boolean, message?: LocaleString, overheal?: boolean, inf?: Player, fixed?: boolean } = {}) {
        if (user.hp >= user.maxhp * user.overheal && !opts.overheal) return false
        if (user.dead) return false
        user.addEvent({ type: "heal", amount }, this.turn)
        let max = user.maxhp * user.overheal
        if (!opts.fixed) {
            amount *= (user.cstats.inheal / 100)
            if (opts.inf) {
                amount *= (opts.inf.cstats.outheal / 100)
            }
        }
        // Healing becomes less effective the higher above max HP the player is
        amount /= Math.max(Math.ceil(user.hp / user.maxhp), 1)
        amount = Math.round(amount)
        if (amount <= 0) return false
        let hp = Math.max(Math.min(max - user.hp, amount), 0)
        if (opts.overheal) hp = amount;
        if (hp <= 0) return false
        user.hp += hp
        user.healingInTurn += hp
        if (!opts.silent)
            this.log(getString(opts.message ?? "heal.generic", { player: user.toString(), AMOUNT: Math.floor(amount) }), "green")
        return true
    }
    heal(user: Player, amount: number, silent: boolean = false, message: LocaleString = "heal.generic", overheal: boolean = false) {
        return this.healO(user, amount, { silent, message, overheal })
    }
    get isPve() {
        return this.type == "boss" || this.type == "pve"
    }
    get hasTeams() {
        return this.type == "boss" || this.type == "pve" || this.isTeamMatch()
    }
    critRoll(p: Player, t: Player, mult: number): number {
        let critDmg = 1 + p.cstats.critdmg / 100
        let fmult = 1
        let critChance = p.cstats.crit / 100 * mult
        // I'm desperately trying to make going for Speed a good option
        if (p.positionInTurn < t.positionInTurn) {
            critChance *= 1.2
        }
        let critRoll = this.rng.get01()
        if (critRoll < critChance) {
            if (critRoll < critChance - 1) {
                this.logL("dmg.supercrit", {}, "red")
                critDmg += p.cstats.critdmg / 100
            } else {
                this.logL("dmg.crit", {}, "red")
            }
            fmult *= critDmg
            //dmg = Math.floor(dmg * critDmg)
        }
        return fmult
    }
    addCharge(p: Player, amt: number, silent: boolean = false) {
        let mult = p.cstats.chgbuildup / 100
        amt = Math.ceil(amt * mult)
        p.charge += amt
        if (!silent) {
            this.logL("move.charge.gain", { player: p.toString(), amount: amt })
        }
        if (p.summoner) {
            this.addCharge(p.summoner, amt * 0.3, true)
        }
    }
    addMagic(p: Player, amt: number, silent: boolean = false) {
        let mult = p.cstats.magbuildup / 100
        amt = Math.ceil(amt * mult)
        p.magic += amt
        if (!silent) {
            this.logL("move.magic.gain", { player: p.toString(), amount: amt })
        }
        if (p.summoner) {
            this.addMagic(p.summoner, amt * 0.3, true)
        }
    }

    doAction(action: TurnAction) {
        switch (action.type) {
            case "move": {
                let user = action.player
                let move = moves.get(action.move)
                if (!move) return this.log(`What`)
                if (move.type != "protect" && action.player.protectTurns > 0) {
                    if (action.player.protectTurns > 5) {
                        action.player.protectTurns = 5
                    }
                    action.player.protectTurns--
                }
                this.log(getString("move.use", { player: action.player.toString(), MOVE: move.name }))
                this.logIndent++
                let mOpts: MoveCastOpts = {
                    category: move.category,
                    requiresCharge: move.requiresCharge,
                    requiresMagic: move.requiresMagic,
                    accuracy: move.accuracy,
                    pow: move.power || 0,
                    critMul: move.critMul,
                    multihit: move.multihit,
                    enhance: action.player.getEnhanceLevel(action.move)
                }
                move.applyEnhance(mOpts, mOpts.enhance)
                let supportTarget = action.player
                if (!this.isEnemy(action.player, action.target)) supportTarget = action.target
                if (move.supportTargetting) {
                    action.target = supportTarget
                }
                if (action.player.forceTarget) {
                    action.target = action.player.forceTarget
                    action.player.forceTarget = undefined
                }
                mOpts.pow = move.getPower(this, action.player, action.target, mOpts.enhance)
                if (user.itemSlots.offense) {
                    let item = user.itemSlots.offense
                    let itemType = items.get(item.id)
                    itemType?.onMoveUse?.(this, user, item, action.move, mOpts)
                }
                let missed = this.rng.get01() > mOpts.accuracy / 100
                if (missed) this.log(getString("move.miss"))
                let failed = !move.checkFail(this, action.player, action.target) || action.player.magic < mOpts.requiresMagic || action.player.charge < mOpts.requiresCharge
                if (failed && !missed) this.log(getString("move.fail"))
                action.player.magic -= mOpts.requiresMagic
                action.player.charge -= mOpts.requiresCharge
                action.player.addEvent({ type: "move", move: action.move, failed: failed || missed, target: action.target }, this.turn)
                if (failed || missed) return
                let onUse = move.onUse
                if (onUse && move.onUseOverride) {
                    onUse(this, action.player, action.target, mOpts)
                } else if (move.type == "attack") {
                    let cat = mOpts.category
                    let requiresCharge = mOpts.requiresCharge
                    let requiresMagic = mOpts.requiresMagic
                    let pow = mOpts.pow
                    let atk = getATK(action.player, cat)
                    if (cat == "physical" && !requiresCharge) {
                        this.addCharge(action.player, pow / 6, true)
                    } else if (cat == "special" && !requiresMagic) {
                        this.addMagic(action.player, pow / 6, true)
                    }
                    let dmg = pow / 100 * atk
                    let opts: TakeDamageOptions = {
                        silent: false,
                        atkLvl: action.player.level,
                        inflictor: action.player,
                        type: cat,
                        defStat: categories[cat].def,
                        defPen: 0,
                        breakshield: move.breakshield,
                    }
                    if (move.setDamage == "set") {
                        dmg = Math.floor(pow)
                    } else if (move.setDamage == "percent") {
                        dmg = Math.ceil(pow / 100 * action.target.maxhp)
                    }
                    let hitCount = mOpts.multihit
                    dmg = Math.ceil(dmg / move.multihit)
                    let prevIndent = this.logIndent++
                    for (let i = 0; i < hitCount; i++) {
                        this.logIndent = prevIndent
                        let finalDmg = Math.ceil(dmg * this.critRoll(action.player, action.target, mOpts.critMul))
                        this.takeDamageO(action.target, finalDmg, opts)
                    }
                } else if (move.type == "protect") {
                    if (this.rng.get01() > (1 / (action.player.protectTurns + 1))) return this.log(getString("move.fail"))
                    action.player.protectTurns++
                    supportTarget.protect = true
                } else if (move.type == "heal") {
                    let pow = move.getPower(this, action.player, supportTarget) / 100
                    this.healO(supportTarget, Math.floor(user.maxhp * pow), {
                        overheal: move.overheal,
                        inf: action.player
                    })
                } else if (move.type == "absorption") {
                    let pow = move.getPower(this, action.player, supportTarget) / 100
                    //this.addAbsorption(supportTarget, Math.floor(supportTarget.maxhp * pow), move.absorptionTier)
                }
                if (move.requiresMagic <= 0 && move.type != "attack")
                    action.player.magic += Math.floor(action.player.cstats.magbuildup / 100 * 10)
                if (move.recoil) {
                    let recoilDmg = Math.ceil(action.player.maxhp * move.recoil)
                    recoilDmg = Math.min(recoilDmg, action.player.hp - 1)
                    this.takeDamage(action.player, recoilDmg, false, "dmg.recoil")
                }
                if (this.rng.get01() < move.userStatChance) {
                    for (let k in move.userStat) {
                        this.statBoost(action.player, k as StatID, move.userStat[k as StatID])
                    }
                }
                if (this.rng.get01() < move.targetStatChance) {
                    for (let k in move.targetStat) {
                        this.statBoost(action.target, k as StatID, move.targetStat[k as StatID])
                    }
                }
                for (let i of move.inflictStatus) {
                    if (this.rng.get01() < i.chance) {
                        this.inflictStatus(action.target, i.status, action.player)
                    }
                }
                if (onUse && !move.onUseOverride) {
                    onUse(this, action.player, action.target, mOpts)
                }
                break;
            }
            case "item": {

            }
        }
    }
    inflictStatus(u: Player, s: string, inf?: Player): Status | undefined {
        let sType = statusTypes.get(s)
        if (sType) {
            let a = u.status.find(el => el.type == s)
            let o: Status = {
                type: s,
                turns: 0,
                inflictor: inf,
                infStats: inf?.getFinalStats(),
                turnsLeft: sType.duration,
                duration: sType.duration,
                data: undefined
            }
            if (a) {
                if (sType.upgradeTo) {
                    sType.end(this, u, a)
                    a.duration = 0;
                    return this.inflictStatus(u, sType.upgradeTo, inf)
                }
                sType.end(this, u, a)
                a.duration = Math.max(a.duration, o.duration)
                a.turnsLeft = a.duration
                if (inf) {
                    a.inflictor = inf
                    a.infStats = inf.getFinalStats()
                }
                sType.start(this, u, a)
                return a
            }
            u.status.push(o)
            sType.start(this, u, o)
            return o
        }
    }
    doStatusUpdate(u: Player, s: Status) {
        let sType = statusTypes.get(s.type)
        if (sType) {
            sType.turn(this, u, s)
        }
        s.turnsLeft--
        s.turns++
    }
    lengthPunishmentsStart = 30
    turnLimit = 50
    /** @returns `true` if `a` should be done before `b` */
    cmpActions(a: TurnAction, b: TurnAction) {
        let spda = a.player.cstats.spd
        let spdb = b.player.cstats.spd
        let prioa = getPriority(a)
        let priob = getPriority(b)
        if (prioa != priob) return prioa > priob
        return spda > spdb
    }
    doActions() {
        if (this.ended) return
        this.turn++
        this.logs = []
        this.logIndent = 0
        this.log(`Turn ${this.turn}`)
        for (let u of this.players) {
            u.protect = false
            u.prevHp = u.hp
            u.prevAbsorption = u.getTotalAbsorption()
            u.healingInTurn = 0
        }
        this.log("Item/Ability", "accent")
        for (let p of this.players) {
            if (p.dead) continue;
            this.logIndent = 1
            p.positionInTurn = 9999
            p.updateItems()
            let ab = abilities.get(p.ability || "")
            if (ab) {
                ab.turn(this, p)
            }
            for (let it of p.helditems) {
                let type = items.get(it.id)
                if (type) {
                    type.turn(this, p, it)
                }
            }
            p.updateItems()
            p.absorptionMods = p.absorptionMods.filter(el => el.active)
        }
        this.logIndent = 0
        this.log("Action")
        let actionQueue = new Set(this.actions)
        let i = 0
        while (actionQueue.size > 0) {
            let fastest: TurnAction | null = null
            for (let action of actionQueue) {
                if (fastest == null) {
                    fastest = action
                    continue
                }
                if (!this.cmpActions(action, fastest)) continue
                fastest = action
            }
            let a = fastest as TurnAction
            actionQueue.delete(a)
            if (a.player.dead) continue
            a.player.positionInTurn = i++
            this.logIndent = 1
            try {
                this.log(`${a.player.name}'s turn`, "accent")
                this.logIndent++
                this.doAction(a)
                a.player.damageBlockedInTurn = 0
                a.player.damageTakenInTurn = 0
            } catch (er) {
                console.error(er)
            }
        }
        while (this.actions.length > 0) {
            this.actions.pop()
        }
        this.logIndent = 0
        this.log("Status", "accent")
        for (let u of this.players) {
            this.logIndent = 1
            u.forceTarget = undefined
            for (let s of u.status) {
                this.doStatusUpdate(u, s)
            }
            for (let k in u.modifiers) {
                let mods = u.modifiers[k as ExtendedStatID]
                let modExpired = false
                for (let mod of mods) {
                    if (mod.expires == undefined) {
                        continue
                    }
                    mod.expires--
                    modExpired ||= mod.expires <= 0
                }
                if (modExpired) {
                    u.modifiers[k as ExtendedStatID] = mods.filter(v => v.expires == undefined || v.expires > 0)
                    u.updateStats()
                }
            }
            u.status = u.status.filter(el => {
                if (el.turnsLeft <= 0) {
                    statusTypes.get(el.type)?.end(this, u, el)
                }
                return el.turnsLeft > 0
            })
        }
        this.logIndent = 0
        // Discourage stalling until the heat death of the universe by doing some stuff
        if (this.lengthPunishmentsStart > 0) {
            let start = this.lengthPunishmentsStart
            if (this.turn == start) {
                this.log(`Turn ${start} has been reached`, "red")
            }
            if (this.turn == start || this.turn == start + 2 || this.turn == start + 5) {
                for (let p of this.players) {
                    this.multiStatBoost(p, {
                        def: -1,
                        spdef: -1,
                        atk: 1,
                        spatk: 1,
                    }, true)
                }
            }
            if (this.turn == start + 5) {
                this.log(`Turn ${start + 5} has been reached, everyone will now take damage each turn`, "red")
            }
            if (this.turn >= start + 5) {
                for (let p of this.players) {
                    this.takeDamage(p, p.maxhp * (1 / 16 * (1 + ((this.turn - 25) / 2))), false, "dmg.generic", true)
                }
            }
        }
        this.lastImg = undefined
        if (BattleTypeInfo[this.type].endCondition(this) || this.turn >= this.turnLimit) {
            this.ended = true
            let winner = BattleTypeInfo[this.type].getWinner(this, BattleTypeInfo[this.type].ranker)
            if (typeof winner == "number") {
                this.emit("end", `Team ${teamNames[winner]}`)
                return
            }
            this.emit("end", winner)
            return
        }
        this.sortPlayers()
        this.emit("newTurn")
    }
    getTeams() {
        let teams: Player[][] = []
        for (let p of this.players) {
            if (!teams[p.team]) teams[p.team] = []
            teams[p.team].push(p)
        }
        return teams
    }
    getMissingActionsFor(u: User): Player[] {
        let userPlayer = this.players.find(p => p.user?.id == u.id)
        if (!userPlayer) return []
        let players = [userPlayer, ...userPlayer.summons]
        let missing: Player[] = []
        for (let p of players) {
            if (p.isBot()) {
                continue
            }
            if (this.actions.some(el => el.player.id == p.id)) {
                continue
            }
            if (p.dead) {
                continue
            }
            missing.push(p)
        }
        return missing
    }
    addAction(action: TurnAction) {
        if (action.player.dead) return
        if (this.actions.some(el => el.player.id == action.player.id)) return
        this.actions.push(action)
        this.emit("actionAdded", action)
        if (!action.player.isBot()) this.checkActions()
    }
    moveAction(player: Player, move: string, target: Player) {
        this.addAction({
            player,
            target,
            type: "move",
            move,
        })
    }
}