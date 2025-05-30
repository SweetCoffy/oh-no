import { EventEmitter } from "events"
import { User, Collection, APIEmbedField, AttachmentBuilder, SendableChannels, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"
import { setKeys, rng, bar, Dictionary, getID, xOutOfY, formatString, getName, barDelta, dispDelta } from "./util.js"
import { makeStats, calcStats, Stats, baseStats, StatID, calcStat, ExtendedStatID, ExtendedStats, makeExtendedStats } from "./stats.js"
import { moves, Category } from "./moves.js"
import { BattleLobby } from "./lobby.js"
import { getString, LocaleString } from "./locale.js"
import { getUser } from "./users.js"
import { HeldItem, ItemClass, items } from "./helditem.js"
import { FG_Gray, Start, Reset, LogColor, LogColorWAccent } from "./ansi.js"
import { abilities } from "./abilities.js"
import { BotAI, BotAISettings } from "./battle-ai.js"

export const BASELINE_DEF = 250

export function calcDamage(dmg: number, def: number, level: number) {
    let lf = calcStat(BASELINE_DEF, level)
    return Math.ceil(dmg * (lf / (def + lf)))
}
export function calcMoveDamage(pow: number, atk: number, def: number, level: number) {
    return calcDamage((atk * pow / 100), def, level)
}
export interface CategoryStats {
    atk: string,
    def: string,
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
    return (p.hp + p.plotArmor) / (p.maxhp + p.plotArmor)
}
function sfRanking(p: Player) {
    return p.damageDealt
}
function ffaGetWinner(b: Battle, ranking: GetRankingFn) {
    return b.players.sort((a, b) => ranking(b) - ranking(a))[0]
}
function ffaEndCondition(b: Battle) {
    let alivePlayers = b.players.filter(p => !p.dead)
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
export class StatusType {
    name: string
    short: string
    duration = 4
    upgradeTo?: string
    icon?: string
    negative: boolean = true
    onStart?: StatusCallback
    onTurn?: StatusCallback
    onEnd?: StatusCallback
    start(b: Battle, p: Player, s: Status) {
        if (this.onStart) this.onStart(b, p, s)
    }
    turn(b: Battle, p: Player, s: Status) {
        if (this.onTurn) this.onTurn(b, p, s)
    }
    end(b: Battle, p: Player, s: Status) {
        if (this.onEnd) this.onEnd(b, p, s)
    }
    constructor(name: string, short?: string, onStart?: StatusCallback, onTurn?: StatusCallback, onEnd?: StatusCallback, upgradeTo?: string) {
        this.name = name
        this.short = short || name
        this.onStart = onStart
        this.onTurn = onTurn
        this.onEnd = onEnd
        this.upgradeTo = upgradeTo
    }
    set(func: (el: StatusType) => any) {
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
export let statusTypes: Collection<string, StatusType> = new Collection()
const STATUS_BASELINE_SPATK = 50
statusTypes.set("poison", new StatusType("Poison", "Poison", statusMessageEffect("status.poison.start"),
    function (b, p, s) {
        let base = s.infStats?.spatk ?? calcStat(STATUS_BASELINE_SPATK, p.level)
        let mult = 1 / 5
        if (b.type == "pve" && p.team == 0) {
            mult /= 2
        }
        b.takeDamageO(p, base * mult, {
            silent: false,
            message: "dmg.poison",
            inflictor: s.inflictor,
            type: "status",
            defStat: "spdef",
        })
    }, undefined))
statusTypes.set("regen", new StatusType("Regeneration", "Regen", (b, p, s) => {
    statusTypes.get(s.type)?.onTurn?.(b, p, s)
}, function (b, p, s) {
    let base = p.maxhp
    let mult = 1 / 16
    b.heal(p, Math.ceil(base * mult), false, "heal.regeneration")
}, undefined))
statusTypes.set("bleed", new StatusType("Bleeding", "Bleed", (b, p) => b.logL("status.bleed.start", { player: p.toString() }), (b, p, s) => {
    let base = s.infStats?.atk ?? calcStat(STATUS_BASELINE_SPATK, p.level)
    let mult = 1 / 5
    b.takeDamageO(p, base * mult, {
        silent: false,
        inflictor: s.inflictor,
        message: "dmg.bleed",
        type: "status",
        defStat: "def",
    })
}))
type StatusModifierData = {
    mods: (StatModifier & { id: string, stat: StatID })[]
}
let rush = new StatusType("Reckless Rush", "Rush", (b, p, s) => {
    let charge = p.charge
    p.charge = 0
    let mods = []
    mods.push(p.addModifier("atk", {
        label: "Reckless Rush",
        type: "multiply",
        value: 1 + Math.min((charge + 20) / 100, 1),
    }))
    let data: StatusModifierData = { mods }
    s.data = data
    b.logL("status.rush.start", { player: p.toString() })
}, undefined, (b, p, s) => {
    let data = s.data as StatusModifierData
    for (let mod of data.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
})
let overclock = new StatusType("Overclock", "Overclock", (b, p, s) => {
    let magic = p.magic
    p.magic = p.maxMagic
    let mods = []
    mods.push(p.addModifier("spatk", {
        label: "Overclock",
        type: "multiply",
        value: 1 + Math.min((magic + 25) / 200, 1),
    }))
    let data: StatusModifierData = { mods }
    s.data = data
    b.logL("status.overclock.start", { player: p.toString() })
}, (b, p, s) => {
    p.magic = p.maxMagic
}, (b, p, s) => {
    let data = s.data as StatusModifierData
    for (let mod of data.mods) {
        p.removeModifier(mod.stat, mod.id)
    }
    p.magic = 0
})

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
export const MAX_STAT_STAGES = 8
export function calcMul(stages: number) {
    if (stages > 0) return Math.min(1 + (stages / MAX_STAT_STAGES * 2), 2)
    if (stages < 0) return Math.max(1 / (stages / MAX_STAT_STAGES * 4), 0.25)
    return 1
}
export function getDEF(player: Player, category: Category) {
    return Number(player[categories[category].def])
}
export function getATK(player: Player, category: Category) {
    return Number(player[categories[category].atk])
}
export interface Status {
    duration: number,
    turns: number,
    turnsLeft: number,
    inflictor?: Player,
    infStats?: ExtendedStats
    type: string,
    data?: object,
}
export interface StatModifier {
    type?: "add" | "multiply",
    multCombine?: "add" | "multiply",
    value: number,
    disabled?: boolean,
    label?: string,
}
export type StatModifierWithID = StatModifier & { id: string }
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
}
/**
 * Represents an in-battle player
 */
export class Player {
    /** The player's current HP */
    hp: number = 0
    prevHp: number = 0
    /** The player's Max HP */
    get maxhp() {
        return this.cstats.hp;
    }
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
    /** The type of Bruh Orb the player has activated */
    bruh?: string = undefined
    /** The team the player belongs to */
    team: number = 0
    /** The amount of absorption health the player has */
    absorption: number = 0
    /** The tier of absorption, each tier granting +10% damage reduction over the previous one */
    absorptionTier: number = 0
    private _charge: number = 0
    private _magic: number = 0
    get maxMagic() {
        return this.cstats.maglimit
    }
    get maxCharge() {
        return this.cstats.chglimit
    }
    /** How far into the negatives the player's health can go before dying, used by the Plot Armor ability */
    plotArmor: number = 0
    /** The list of usable moves for the player, only used for user-controlled players */
    moveset: string[] = ["bonk", "nerf_gun", "stronk", "spstronk"]
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
    }
    abilityData: any = {}
    ability?: string
    toString() {
        return `[${teamColors[this.team] || "a"}]${this.name}[r]`
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
        return Math.max(Math.round(((value + value * multAddAccumulator) * multAccumulator) + addAccumulator), 0)
    }
    addModifier(stat: StatID, mod: StatModifier) {
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
    removeModifier(stat: StatID, id: string) {
        let i = this.modifiers[stat].findIndex(el => el.id == id)
        if (i == -1) return
        this.modifiers[stat].splice(i, 1)
        this.recalculateStats()
    }
    getModifier(stat: StatID, id: string) {
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
    /** The player's true (unmodified) stats */
    stats: ExtendedStats = makeExtendedStats()
    /** The player's base stats, usually taken from their preset */
    baseStats: Stats = { ...baseStats }
    /** The Discord user the player belongs to, used to get the current name and other stuff that needs a Discord user */
    user?: User
    /** The player's status conditions */
    status: Status[] = []
    /** The player's stat modifiers */
    statStages: Stats = makeStats()
    private statStageModifiers: {[x in StatID]: StatModifier}
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
    get atk() { return this.cstats.atk }
    get def() { return this.cstats.def }
    get spatk() { return this.cstats.spatk }
    get spdef() { return this.cstats.spdef }
    get spd() { return this.cstats.spd }
    get dr() { return this.cstats.dr }

    cstats: ExtendedStats = {
        ...makeExtendedStats(),
    }

    _tempname = ""
    get name() {
        if (this._nickname) return this._nickname
        if (this.user) return this.user.username
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
        this.cstats.hp = Math.max(this.cstats.hp, 1)
        this.cstats.dr = Math.min(this.cstats.dr, 100)
        this.cstats.crit = Math.min(this.cstats.crit, 100)
    }
    /**
     * Updates the player's current stats to match what they should be according to level and base stats
     * @param updateHp Whether or not to increase or decrease current HP if Max HP is different
     */
    updateStats(updateHp: boolean = true) {
        let lastmax = this.maxhp
        setKeys(defaultStats, this.stats)
        let resourceBaseline = calcStat(100, this.level)
        setKeys(calcStats(this.level, this.baseStats), this.stats)
        this.stats.chglimit = Math.ceil(Math.max(30 + this.stats.atk / resourceBaseline * 40, 50) / 5) * 5
        this.stats.maglimit = Math.ceil(Math.max(30 + this.stats.spatk / resourceBaseline * 40, 50) / 5) * 5
        this.stats.crit = Math.min(Math.ceil(this.stats.spd / resourceBaseline * 10), 50)
        this.recalculateStats()
        let max = this.maxhp
        if (updateHp) this.hp = Math.ceil(this.hp * (max / lastmax))
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
        this.helditems = this.helditems.filter(el => !el.remove)
        for (let k in this.itemSlots) {
            this.itemSlots[k as ItemClass] = undefined
        }
        for (let item of this.helditems) {
            let itemType = items.get(item.id)
            if (!itemType) continue
            if (itemType.class != "passive") {
                if (!this.itemSlots[itemType.class]) this.itemSlots[itemType.class] = item
            }
        }
    }
    constructor(user?: User) {
        if (user) {
            this.user = user
            this.baseStats = { ...getUser(user).baseStats }
        }
        this.id = getID()
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
        //@ts-ignore
        this.statStageModifiers = stageModifiers

        this.updateStats()
        this.updateStatStages()
        this.hp = this.maxhp
        this.prevHp = this.hp
        this._tempname = getName()
    }
    [key: string]: number | any
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
}
type TakeDamageType = "none" | Category | "ability"
export interface TakeDamageOptions {
    silent?: boolean,
    message?: LocaleString,
    inflictor?: Player,
    breakshield?: boolean,
    type?: TakeDamageType,
    defStat?: StatID,
    defPen?: number
    atkLvl?: number
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
    ended: boolean = false
    start() {
        this.players.sort((a, b) => a.team - b.team)
        for (let p of this.players) {
            p.helditems = [...new Set(p.helditems.map(el => el.id))].map(el => ({ id: el }))
            p.updateItems()
            for (let item of p.helditems) {
                let itemType = items.get(item.id)
                if (!itemType) continue
                itemType.onBattleStart?.(this, p, item)
            }
            p.aiState = new BotAI(this, p, p.aiSettings)
        }
        let start = BattleTypeInfo[this.type].onStart
        if (start) start(this)
    }
    isTeamMatch() {
        return isTeamMatch(this.type)
    }
    isEnemy(player: Player, target: Player) {
        if (player == target) return false
        if (!this.hasTeams) return true
        return player.team != target.team
    }
    async infoMessage(channel: SendableChannels) {
        let b = this
        let humans = this.players.filter(el => el.team == 0)
        let bots = this.players.filter(el => el.team == 1)
        function getIcons(player: Player) {
            let icons = ""
            for (let s of player.status) {
                let icon = statusTypes.get(s.type)?.icon;
                if (s.duration <= 0) continue;
                if (!icon) continue;
                icons += icon;
            }
            if (player.bruh) icons += "⌃"
            return icons;
        }
        function playerInfo(p: Player) {
            if (p.dead) return `${Start}0;${FG_Gray}m- ${p.name}${Reset}`
            let icons = getIcons(p)
            let barColor = "green"
            if (p.hp <= p.maxhp / 2) barColor = "yellow"
            if (p.hp <= p.maxhp / 4) barColor = "red"
            let hpString = xOutOfY(Math.floor(p.hp), p.maxhp, true)
            if (p.maxhp != p.stats.hp) {
                hpString += formatString(`[u]/${Math.floor(p.stats.hp)}[r]`)
            }
            let barW = Math.min(Math.max(Math.floor(10 * p.maxhp / p.stats.hp), 1), 20)
            let str = `${Start}0;${FG_Gray}m${icons}${Reset}${p.name}` + "\n" +
                formatString(`[${barColor}]${barDelta(p.hp, p.prevHp, p.maxhp, barW)}| ${hpString}`)
            str += "\n"
            if (p.charge || p.magic) {
                if (p.charge) {
                    str += formatString(`[red]C ${xOutOfY(p.charge, p.maxCharge, true)} `)
                }
                if (p.magic) {
                    str += formatString(`[blue]M ${xOutOfY(p.magic, p.maxMagic, true)} `)
                }
            }
            if (p.status.length > 0) {
                str += p.status.map(v => statusTypes.get(v.type)?.short || "UNKN").join(" ")
            }
            return str.trimEnd()
        }
        let str = ""
        if (true) {
            let teams: Player[][] = []
            for (let p of this.players) {
                if (!teams[p.team]) teams[p.team] = []
                teams[p.team].push(p)
            }
            if (this.hasTeams) {
                for (let i in teams) {
                    let damageDealt = 0
                    let damageTaken = 0
    
                    let totalMaxHealth = 0
                    let totalHealth = 0
    
                    let players = teams[i]
                    str += formatString(`[${teamColors[i]}]Team ${teamNames[i]}[r]\n`)
                    for (let p of players) {
                        damageDealt += p.damageDealt
                        damageTaken += p.damageTaken
                        totalMaxHealth += p.maxhp + p.plotArmor
                        totalHealth += p.hp + p.plotArmor
                        str += "\n" + playerInfo(p)
                    }
    
                    let hpColor = "red"
                    if (totalHealth > totalMaxHealth / 5) hpColor = "yellow"
                    if (totalHealth > totalMaxHealth / 2) hpColor = "green"

                    str += "\n"
                    if (players.length > 1) {
                        str += formatString(`[${teamColors[i]}]Team Health[r]\n`)
                        str += formatString(`[${teamColors[i]}]${bar(totalHealth, totalMaxHealth, 25)}|\n[${hpColor}]${xOutOfY(Math.ceil(totalHealth), totalMaxHealth, true)}\n`)
                    }
                    str += "—————————————————————\n"
                }
            } else {
                for (let p of this.players) {
                    str += "\n" + playerInfo(p)
                }
            }
            str = `\`\`\`ansi\n${str}\n\`\`\``
        }
        let fields: APIEmbedField[] = []
        let msg = await channel.send({
            content: this.lobby?.users.map(el => el.toString()).join(" "),
            embeds: [
                {
                    description: str,
                    fields: [
                        ...fields,
                    ]
                },
                {
                    description: "```ansi" + "\n" + b.logs.slice(-35).join("\n").slice(-1900) + "\n```"
                }
            ],
            //files: [new AttachmentBuilder(Buffer.from(b.logs.join("\n"))).setName("log.ansi")],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .setComponents(new ButtonBuilder()
                        .setLabel("ATTACK")
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId("choose:open_selector"))
            ]
        })
        return msg
    }
    type: BattleType
    constructor(lobby: BattleLobby) {
        super()
        this.lobby = lobby
        this.type = lobby.type
        this.turnLimit = BattleTypeInfo[this.type].turnLimit ?? 50
    }
    /**
     * Increases `player`'s `stat` stages by `stages` and shows the respective message if `silent` is false
     */
    statBoost(player: Player, stat: StatID, stages: number, silent = false) {
        if (stages == 0) return
        if (!silent && stat == "atk" && stages > 0) {
            player.charge += Math.floor(stages * 5 * player.cstats.chgbuildup / 100)
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
    multiStatBoost(player: Player, stats: { [x in StatID]?: number }, silent: boolean = false) {
        for (let k in stats) {
            this.statBoost(player, k as StatID, stats[k as StatID] as number, silent)
        }
    }
    fullLog: string[] = []
    log(str: string, color: LogColorWAccent = "white") {
        this.fullLog.push(str)
        this.logs.push(formatString(str, color))
        this.emit("log", str)
    }
    logL(str: string, vars: Dictionary<any> | any[], color: LogColorWAccent = "white") {
        this.log(getString(str, vars), color)
    }
    sortActions() {
        return this.actions.sort((a, b) => b.player.stats.spd - a.player.stats.spd).sort((a, b) => getPriority(b) - getPriority(a))
    }
    checkActions() {
        for (let p of this.players) {
            if (!p.user) {
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
        if (user.dead) return false
        if (damage < 0) return this.heal(user, -damage, silent);
        if (breakshield && user.protect) {
            damage /= 4
            user.protect = false
            this.log(getString("dmg.breakthrough", { player: user.toString() }))
        } else if (user.protect) {
            user.damageBlocked += damage
            user.damageBlockedInTurn += damage
            this.log(getString("dmg.block", { player: user.toString(), damage: Math.floor(damage) }))
            return false
        }
        let mirror = user.helditems.find(el => el.id == "mirror")
        if (inflictor && mirror && !mirror.remove) {
            if (!breakshield) {
                let reflect = (mirror.durability ?? (mirror.durability = 100)) / 100 * 0.25
                if (mirror.durability >= 100) {
                    this.logL("item.mirror.perfect", { player: user.toString() })
                    reflect = 0.6
                }
                let dmg = Math.floor(Math.min(damage, user.maxhp * 0.75) * reflect)
                mirror.durability -= (damage / user.maxhp) * 200
                let mirrorMax = Math.floor(user.maxhp / 2)
                let mirrorCur = Math.floor(mirror.durability / 100 * user.maxhp / 2)
                this.logL("item.mirror.reflect", { player: user.toString(), bar: `[${xOutOfY(mirrorCur, mirrorMax)}]` })
                this.takeDamage(inflictor, dmg, false, "dmg.generic", false)
                damage = Math.floor(damage * (1 - reflect))
            } else mirror.durability = 0;
            //@ts-ignore
            if (mirror?.durability <= 0) {
                this.logL("item.mirror.shatter", { player: user.toString() })
                this.statBoost(user, "def", -1)
                this.statBoost(user, "spdef", -1)
                mirror.remove = true
                this.takeDamage(user, user.maxhp / 8)
                this.logL("item.mirror.shards", { player1: user.toString(), player2: inflictor.toString() }, "red")
                this.inflictStatus(user, "bleed")
                this.inflictStatus(inflictor, "bleed")
            }
        }
        if (inflictor) {
            if (inflictor.itemSlots.offense) {
                let item = inflictor.itemSlots.offense
                let itemType = items.get(item.id)
                let newDmg = itemType?.onDamageDealt?.(this, inflictor, item, damage, user, opts)
                if (typeof newDmg == "number") {
                    damage = newDmg
                }
            }
        }
        if (user.itemSlots.defense) {
            let item = user.itemSlots.defense
            let itemType = items.get(item.id)
            let newDmg = itemType?.onDamage?.(this, user, item, damage, opts)
            if (typeof newDmg == "number") {
                damage = newDmg
            }
        }
        if (opts.atkLvl && opts.defStat) {
            let pen = (opts.defPen || 0)
            let lvl = opts.atkLvl
            let def = Math.max(user[opts.defStat] * (1 - pen), 1)
            damage = calcDamage(damage, def, lvl)
        }
        opts.inflictor = inflictor
        opts.silent = silent
        opts.breakshield = breakshield
        opts.message = message
        let ab = abilities.get(user.ability ?? "")
        let infAb = abilities.get(inflictor?.ability ?? "")
        if (ab?.damage) {
            let dmgOverride = ab.damage(this, user, damage, inflictor, opts)
            if (dmgOverride != null) {
                damage = dmgOverride
            }
        }
        user.addEvent({ type: "damage", amount: damage, inflictor }, this.turn)
        if (damage == 0) {
            if (!silent) this.logL("dmg.none", { player: user.toString() }, "unimportant")
            return
        }
        if (user.absorption > 0) {
            let reduction = Math.min(user.absorptionTier, 9) * 0.1
            user.absorption -= damage * reduction;
            damage *= 1 - reduction;
            if (user.absorption <= 0) {
                user.absorptionTier = 1
                user.absorption = 0
            };
        }
        if (inflictor && infAb?.damageDealt) {
            infAb.damageDealt(this, inflictor, damage, user, opts)
        }
        if (isNaN(damage)) return this.log(`Tried to deal NaN damage to ${user.name}`, "yellow")
        if (inflictor) inflictor.damageDealt += damage
        user.hp -= damage
        if (isNaN(user.hp)) user.hp = 0;

        user.damageTaken += damage
        if (!silent) this.log(getString(message, { player: user.toString(), damage: Math.floor(damage) + "" }), "red")
        let death = 0 - user.plotArmor
        if (user.hp <= death) {
            if (Math.random() < 0.05) {
                user.hp = death + 1
                this.logL(`dmg.rng`, { player: user.toString() })
                return true
            }
            if (user.hp < -user.maxhp + death) this.logL("dmg.overkill", { player: user.toString() }, "red")
            else this.log(getString("dmg.death", { player: user.toString() }), "red")
            user.hp = death
            return true
        }
        if (user.hp + damage > 0 && user.hp <= 0 && user.hp > death) {
            this.logL("dmg.plotarmor", { player: user.toString() }, "accent")
        }

        return true
    }
    takeDamageO(user: Player, damage: number, options: TakeDamageOptions = {}) {
        return this.takeDamage(user, damage, options.silent, (options.message || "dmg.generic") as LocaleString, options.breakshield, options.inflictor, options)
    }
    heal(user: Player, amount: number, silent: boolean = false, message: LocaleString = "heal.generic", overheal: boolean = false) {
        if (user.status.some((s) => s.type == "bleed")) return false
        if (user.hp >= user.maxhp * user.overheal && !overheal) return false
        if (user.dead) return false
        user.addEvent({ type: "heal", amount }, this.turn)
        let max = user.maxhp * user.overheal
        // Healing becomes less effective the higher above max HP the player is
        amount /= Math.max(Math.ceil(user.hp / user.maxhp), 1)
        let hp = Math.max(Math.min(max - user.hp, amount), 0)
        if (overheal) hp = amount;
        if (hp <= 0) return
        user.hp += hp
        if (!silent) this.log(getString(message, { player: user.toString(), AMOUNT: Math.floor(amount) + "" }), "green")
    }
    addAbsorption(user: Player, amount: number, tier: number = 1) {
        if (user.absorptionTier > tier) amount /= (user.absorptionTier - tier) / 3 + 1
        user.absorption += Math.floor(amount)
        if (user.absorption > user.maxhp) {
            user.absorption = user.maxhp / 3
            if (user.absorptionTier < 9) user.absorptionTier++
        }
        if (user.absorptionTier < tier) user.absorptionTier = tier
    }
    get isPve() {
        return this.type == "boss" || this.type == "pve"
    }
    get hasTeams() {
        return this.type == "boss" || this.type == "pve" || this.isTeamMatch()
    }
    doAction(action: TurnAction) {
        switch (action.type) {
            case "move": {
                let user = action.player
                let move = moves.get(action.move)
                if (!move) return this.log(`What`)
                if (move.type != "protect") {
                    action.player.protectTurns = 0
                }
                this.log(getString("move.use", { player: action.player.toString(), MOVE: move.name }))
                let mOpts: MoveCastOpts = {
                    category: move.category,
                    requiresCharge: move.requiresCharge,
                    requiresMagic: move.requiresMagic,
                    accuracy: move.accuracy,
                    pow: move.power || 0,
                    critMul: move.critMul,
                }
                let supportTarget = action.player
                if (this.hasTeams) supportTarget = action.target
                if (move.targetSelf && (!this.hasTeams || action.target.team != action.player.team)) {
                    action.target = action.player
                }
                mOpts.pow = move.getPower(this, action.player, action.target)
                if (user.itemSlots.offense) {
                    let item = user.itemSlots.offense
                    let itemType = items.get(item.id)
                    itemType?.onMoveUse?.(this, user, item, action.move, mOpts)
                }
                let missed = rng.get01() > mOpts.accuracy / 100
                if (missed) this.log(getString("move.miss"))
                let failed = !move.checkFail(this, action.player, action.target) || action.player.magic < mOpts.requiresMagic || action.player.charge < mOpts.requiresCharge
                if (failed && !missed) this.log(getString("move.fail"))
                action.player.magic -= mOpts.requiresMagic
                action.player.charge -= mOpts.requiresCharge
                action.player.addEvent({ type: "move", move: action.move, failed: failed || missed, target: action.target }, this.turn)
                if (failed || missed) return
                let onUse = move.onUse
                if (onUse) {
                    onUse(this, action.player, action.target)
                } else if (move.type == "attack") {
                    let cat = mOpts.category
                    let requiresCharge = mOpts.requiresCharge
                    let requiresMagic = mOpts.requiresMagic
                    let pow = mOpts.pow
                    let critDmg = 1 + action.player.cstats.critdmg / 100
                    let critChance = action.player.cstats.crit / 100 * mOpts.critMul
                    let atk = getATK(action.player, cat)
                    if (cat == "physical" && !requiresCharge) {
                        action.player.charge += Math.floor(pow / 6 * action.player.cstats.chgbuildup / 100)
                    } else if (cat == "special" && !requiresMagic)
                        action.player.magic += Math.floor(pow / 6 * action.player.cstats.magbuildup / 100)
                    let dmg = pow / 100 * atk
                    let opts: TakeDamageOptions = {
                        silent: false,
                        atkLvl: action.player.level,
                        inflictor: action.player,
                        type: cat,
                        defStat: cat == "physical" ? "def" : "spdef",
                        defPen: 0,
                        breakshield: move.breakshield,
                    }
                    if (move.setDamage == "set") {
                        dmg = Math.floor(pow)
                    } else if (move.setDamage == "percent") {
                        dmg = Math.ceil(pow / 100 * action.target.maxhp)
                    }
                    if (rng.get01() < critChance) {
                        this.logL("dmg.crit", {}, "red")
                        dmg = Math.floor(dmg * critDmg)
                    }
                    this.takeDamageO(action.target, dmg, opts)
                } else if (move.type == "protect") {
                    if (rng.get01() > (1 / (action.player.protectTurns / 3 + 1))) return this.log(getString("move.fail"))
                    action.player.protectTurns++
                    supportTarget.protect = true
                } else if (move.type == "heal") {
                    let pow = move.getPower(this, action.player, supportTarget) / 100
                    this.heal(supportTarget, Math.floor(supportTarget.maxhp * pow), false, undefined, move.overheal)
                } else if (move.type == "absorption") {
                    let pow = move.getPower(this, action.player, supportTarget) / 100
                    this.addAbsorption(supportTarget, Math.floor(supportTarget.maxhp * pow), move.absorptionTier)
                }
                if (move.requiresMagic <= 0 && move.type != "attack")
                    action.player.magic += Math.floor(action.player.cstats.magbuildup / 100 * 10)
                if (move.recoil) {
                    let recoilDmg = Math.ceil(action.player.maxhp * move.recoil)
                    this.takeDamage(action.player, recoilDmg, false, "dmg.recoil")
                }
                if (rng.get01() < move.userStatChance) {
                    for (let k in move.userStat) {
                        this.statBoost(action.player, k as StatID, move.userStat[k as StatID])
                    }
                }
                if (rng.get01() < move.targetStatChance) {
                    for (let k in move.targetStat) {
                        this.statBoost(action.target, k as StatID, move.targetStat[k as StatID])
                    }
                }
                for (let i of move.inflictStatus) {
                    if (rng.get01() < i.chance) {
                        this.inflictStatus(action.target, i.status, action.player)
                    }
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
            }
            if (a) {
                if (sType.upgradeTo) {
                    sType.end(this, u, a)
                    a.duration = 0;
                    return this.inflictStatus(u, sType.upgradeTo, inf)
                }
                a.duration = Math.max(a.duration, o.duration)
                if (inf) {
                    a.inflictor = inf
                    a.infStats = inf.getFinalStats()
                }
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
    doActions() {
        if (this.ended) return
        this.turn++
        this.logs = []
        this.log(`Turn ${this.turn}`)
        for (let u of this.players) {
            u.protect = false
            u.prevHp = u.hp
        }
        for (let p of this.players) {
            if (p.dead) continue;
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
        }
        for (let a of this.actions) {
            try {
                if (a.player.dead) continue
                this.doAction(a)
                a.player.damageBlockedInTurn = 0
            } catch (er) {
                console.error(er)
                this.log(`Couldn't perform ${a.player.name}'s action`)
            }
        }
        while (this.actions.length > 0) {
            this.actions.pop()
        }
        for (let u of this.players) {
            for (let s of u.status) {
                this.doStatusUpdate(u, s)
            }
            u.status = u.status.filter(el => {
                if (el.turnsLeft <= 0) {
                    statusTypes.get(el.type)?.end(this, u, el)
                }
                return el.turnsLeft > 0
            })
        }
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
    addAction(action: TurnAction) {
        if (action.player.dead) return
        if (this.actions.some(el => el.player.id == action.player.id)) return
        this.actions.push(action)
        this.emit("actionAdded", action)
        if (action.player.user) this.checkActions()
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