import { User, Collection, TextChannel, Message, TextBasedChannel, EmbedFieldData, MessageAttachment } from "discord.js"
import { EventEmitter } from "events"
import { setKeys, rng, randomRange, bar, experimental, Dictionary, getID, subscriptNum, xOutOfY, name, colorToANSI, LogColor, formatString, LogColorWAccent, format, getName } from "./util.js"
import { makeStats, calcStats, Stats, baseStats, StatID } from "./stats.js"
import { moves, Category, DamageType } from "./moves.js"
import { lobbies, BattleLobby } from "./lobby.js"
import { getString, LocaleID, Locales, LocaleString } from "./locale.js"
import { getUser } from "./users.js"
import { HeldItem, items } from "./helditem.js"
import { enemies } from "./enemies.js"
import { FG_Blue, FG_Gray, FG_Green, FG_Red, FG_White, FG_Yellow, Start, Reset, End, FG_Pink, FG_Cyan } from "./ansi.js"
import { abilities } from "./abilities.js"
import { DAMAGE_MUL, LOWER_FACTOR } from "./params.js"

export type BattleType = "ffa" | "pve" | "boss" | "team_match"
export function calcDamage(pow: number, atk: number, def: number, level: number) {
    return Math.ceil(((atk / def) * (pow / 15)) * (level / 2.1) * (1 + level / LOWER_FACTOR) * DAMAGE_MUL)
}
export interface CategoryStats {
    atk: string,
    def: string,
}
export const teamColors = [
    "blue",
    "red",
    "yellow",
    "green",
]
export const teamEmojis = [
    "🟦",
    "🟥",
    "🟨",
    "🟩",
]
export const teamNames = [
    "Blue",
    "Red",
    "Yellow",
    "Green",
]
export type BotAIType = "normal" | "egg_lord" | "the_cat" | "u";
export class StatusType {
    name: string
    short: string
    minDuration = 3
    maxDuration = 5
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
    return function(b, p, s) {
        b.takeDamage(p, p.maxhp * percent, silent, message)
    }
}
function statusMessageEffect(message: LocaleString): StatusCallback {
    return function(b, p, s) {
        b.log(getString(message, { player: p.toString(), inf: s.inflictor?.toString()}))
    }
}
export var statusTypes: Collection<string, StatusType> = new Collection()
statusTypes.set("poison", new StatusType("Poison", "Poisn", statusMessageEffect("status.poison.start"), 
function (b, p, s) {
    var base = 1/64
    if (b.type == "pve" && p.team == 0) {
        base /= 2
    }
    b.takeDamage(p, p.maxhp * base, false, "dmg.poison")
}, undefined, "toxic"))
statusTypes.set("toxic", new StatusType("Toxic", "Toxic", statusMessageEffect("status.toxic.start"), 
function (b, p, s) {
    var base = 1/32
    if (b.type == "pve" && p.team == 0) {
        base /= 2
    }
    if (p.status.some(el => el.type == "poison")) {
        base += 1/96
    }
    var percent = base * (1 + (s.turns/5))
    b.takeDamage(p, p.maxhp * percent, false, "dmg.poison")
}, undefined, "california"))
statusTypes.set("california", new StatusType("California", "Calif", statusMessageEffect("status.california.start"), 
function (b, p, s) {
    var base = 1/24
    if (b.type == "pve" && p.team == 0) {
        base /= 2
    }
    if (p.status.some(el => el.type == "poison")) {
        base += 1/48
    }
    if (p.status.some(el => el.type == "toxic")) {
        base += 1/48
    }
    var percent = base * (1 + (s.turns/5))
    b.takeDamage(p, p.maxhp * percent, false, "dmg.poison")
}, undefined))
statusTypes.set("regen", new StatusType("Regeneration", "Regen", undefined, function(b, p, s) {
    if (p.status.some(el => el.type == "strong_regen")) {
        return
    }
    var base = 1/16
    b.heal(p, Math.ceil(p.maxhp * base), false, "heal.regeneration")
}, undefined, "strong_regen"))
statusTypes.set("strong_regen", new StatusType("Strong Regeneration", "Regen+", undefined, function(b, p, s) {
    var base = 1/12
    b.heal(p, Math.ceil(p.maxhp * base), false, "heal.regeneration")
}, undefined))
statusTypes.set("bruh", new StatusType("Bruh", "Bruh", function(b, p, s) {
    s.duration = 3
    p.statStages.atk -= 2
    p.statStages.def -= 2
    p.statStages.spatk -= 2
    p.statStages.spdef -= 2
    p.statStages.spd -= 2
    b.inflictStatus(p, "strong_regen", p)
}, function(b, p, s) {
    p.statStages.atk   += 2/3
    p.statStages.def   += 2/3
    p.statStages.spatk += 2/3
    p.statStages.spdef += 2/3
    p.statStages.spd   += 2/3
}, function(b, p, s) {
    p.helditems = []
    p.statStages.atk   += 2/3
    p.statStages.def   += 2/3
    p.statStages.spatk += 2/3
    p.statStages.spdef += 2/3
    p.statStages.spd   += 2/3
    b.heal(p, p.maxhp - p.hp)
}))
statusTypes.set("bleed", new StatusType("Bleeding", "Bleed", (b, p) => b.logL("status.bleed.start", { player: p.toString() }), (b, p) => {
    
}))
var categories: {[key: string]: CategoryStats} = {
    "physical": {
        atk: "atk",
        def: "def"
    },
    "special": {
        atk: "spatk",
        def: "spdef"
    }
}
var curnum = 0
export function calcMul(stages: number) {
    if (stages > 0) return Math.min(1 + (stages / 6 * 3), 4     )
    if (stages < 0) return Math.max(1 + (stages / 8    ), 0.125)
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
    inflictor?: Player,
    turns: number,
    type: string,
}
export interface StatModifier {
    type?: "add" | "multiply",
    value: number,
    disabled?: boolean,
    label?: string,
}
export type StatModifierID = StatModifier & { id: string }
/**
 * Represents an in-battle player
 */
export class Player {
    /** The player's current HP */
    hp: number = 0
    /** The player's Max HP */
    get maxhp() {
        return this.getModifierValue(this.stats.hp, this.modifiers.hp) * calcMul(this.statStages.hp);
    }
    /** HP can reach up to`overheal` × `maxhp` */
    overheal: number = 1
    /** The total damage taken in the battle */
    damageTaken: number = 0
    /** The total damage blocked by Protect in battle */
    damageBlocked: number = 0
    /** The current level, used for stat and damage calculations */
    level: number = 1
    /** How many times has Protect been used in a row, used to lower success rate */
    protectTurns: number = 0
    /** Whether or not the player is protecting */
    protect: boolean = false
    /** The damage blocked in the previous turn, used for Counter */
    damageBlockedInTurn: number = 0
    /** The type of bruh orb the player has activated */
    bruh?: string = undefined
    /** The team the player belongs to */
    team: number = 0
    /** The amount of absorption health the player has */
    absorption: number = 0
    /** The tier of absorption, each tier granting +10% damage reduction over the previous one */
    absorptionTier: number = 0
    private _charge: number = 0
    private _magic: number = 0
    maxCharge: number = 100
    maxMagic: number = 100
    /** How far into the negatives the player's health can go before dying, used by the Plot Armor ability */
    plotArmor: number = 0
    /** The list of usable moves for the player, only used for user-controlled players */
    moveset: string[] = ["bonk", "nerf_gun", "stronk", "spstronk"]
    modifiers: Dictionary<(StatModifier & {id: string})[]> = {
        hp   : [],
        atk  : [],
        def  : [],
        spatk: [],
        spdef: [],
        spd  : [],
    }
    abilityData: any = {}
    ability?: string
    toString() {
        return `[${teamColors[this.team] || "a"}]${this.name}[r]`
    }
    getModifierValue(value: number, mods: StatModifier[]) {
        for (var mod of mods) {
            if (mod.disabled) continue;
            if (mod.type == "add") value += mod.value;
            else value *= mod.value;
        }
        return value
    }
    addModifier(stat: StatID, mod: StatModifier) {
        var id = getID();
        var e = {
            ...mod,
            id: id,
        }
        this.modifiers[stat].push(e);
        return e;
    }
    getModifier(stat: StatID, id: string) {
        return this.modifiers[stat].find(el => el.id == id);
    }
    get charge(): number {
        return Math.min(Math.max(this._charge, 0), this.maxCharge)
    }
    get magic(): number {
        return Math.min(Math.max(this._magic , 0), this.maxMagic )
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
    /** The player's true stats */
    stats: Stats = makeStats()
    /** The player's base stats, usually taken from their preset */
    baseStats: Stats = { ...baseStats }
    /** The Discord user the player belongs to, used to get the current name and other stuff that needs a Discord user */
    user?: User
    /** The player's status conditions */
    status: Status[] = []
    /** The player's stat modifiers */
    statStages: Stats = makeStats()
    /** The ID of the player */
    id: string
    /** The player's current held items */
    helditems: HeldItem[] = []
    /** The type of AI the player uses if `user` is not present */
    ai: BotAIType = "normal"
    /** The base XP yield, only used in hunt */
    xpYield: number = 0

    /** The player's current Attack stat, but with stat modifiers taken into account */
    get atk()   { return this.getModifierValue(this.stats.atk   * calcMul(this.statStages.atk)  , this.modifiers.atk)   }
    /** The player's current Defense stat, but with stat modifiers taken into account */
    get def()   { return this.getModifierValue(this.stats.def   * calcMul(this.statStages.def)  , this.modifiers.def)   }
    /** The player's current Special Attack stat, but with stat modifiers taken into account */
    get spatk() { return this.getModifierValue(this.stats.spatk * calcMul(this.statStages.spatk), this.modifiers.spatk) }
    /** The player's current Special Defense stat, but with stat modifiers taken into account */
    get spdef() { return this.getModifierValue(this.stats.spdef * calcMul(this.statStages.spdef), this.modifiers.spdef) }
    /** The player's current Speed stat, but with stat modifiers taken into account */
    get spd()   { return this.getModifierValue(this.stats.spd   * calcMul(this.statStages.spd)  , this.modifiers.spd)   }
    _tempname = ""
    /**
     * The display name of the player
     */
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
    /**
     * Updates the player's current stats to match what they should be according to level and base stats
     * @param changeHp Whether or not to increase or decrease current HP if Max HP is different
     */
    updateStats(changeHp: boolean = true) {
        var lastmax = this.maxhp
        setKeys(calcStats(this.level, this.baseStats), this.stats)
        this.maxCharge = Math.max(100 + Math.floor(this.baseStats.atk)-100, 75)
        this.maxMagic = Math.max(100 + Math.floor(this.baseStats.spatk)-100, 75)
        var max = this.maxhp
        if (changeHp) this.hp += max - lastmax
    }
    constructor(user?: User) {
        if (user) {
            this.user = user
            this.baseStats = {...getUser(user).baseStats}
        }
        this.id = getID()
        this.stats = makeStats()
        this.updateStats()
        this.hp = this.maxhp
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
class BotAI {
    battle: Battle
    target?: Player
    update() {
        var target = this.battle.players.find(el => el.hp > 0 && el.user)
        if (!target) target = this.battle.players.find(el => el.hp > 0)
        this.target = target
    }
    getAction(player: Player): TurnAction {
        let b = this.battle
        if (player.hp < player.maxhp / 4 && player.helditems.some(el => el.id == "eggs")) {
            return {
                type: "item",
                item: "eggs",
                player: player,
            }
        }
        var targets = this.battle.players.filter(el => this.battle.isEnemy(player, el) && el.hp > -el.plotArmor)
        let allies = this.battle.players.filter(el => !this.battle.isEnemy(player, el) && el != player && el.hp > -el.plotArmor)

        var target = targets[Math.floor(targets.length * Math.random())]
        let ally = allies[Math.floor(allies.length * Math.random())]
        let revenge = false

        if (player.events[b.turn]) {
            // If someone attacked, attack them back
            let inf = (player.events[b.turn].find(ev => ev.type == "damage" && ev.inflictor) as DamagePlayerEvent)?.inflictor
            if (inf) {
                target = inf
                revenge = true
            }
        }

        var bestboost = player.atk > player.spatk ? "stronk" : "spstronk"
        var bestriskboost= player.atk > player.spatk ? "reckless_rush" : "mind_overwork"
        var beststat = player.atk > player.spatk ? "atk" : "spatk"
        var bestmove = player.atk > player.spatk ? "bonk" : "nerf_gun"
        var bestrecoilmove = player.atk > player.spatk ? "slap" : "ping"
        function getBest() {
            return Math.max(player.atk, player.spatk)
        }
        function getBestStages() {
            return player.atk > player.spatk ? player.statStages.atk : player.statStages.spatk
        }
        if (this.battle.type == "team_match" && !revenge) {
            if (player.magic < 30) return {
                type: "move",
                move: bestboost,
                target: ally || player,
                player,
            }
            if (player.magic < player.maxMagic && Math.random() < 0.4) return {
                type: "move",
                move: bestboost,
                target: ally || player,
                player,
            }
            if (ally) {
                if (ally.hp > -ally.plotArmor && ally.hp < ally.maxhp / 2 && player.magic >= 30) return {
                    type: "move",
                    move: "heal",
                    target: ally,
                    player,
                }
            }
            if (player.hp < player.maxhp / 2 && player.magic >= 30) return {
                type: "move",
                move: "heal",
                target: player,
                player
            }
        }
        switch (player.ai) {
            case "u": {
                if (this.battle.turn == 0 || player.hp < player.maxhp / 4) return {
                    type: "move",
                    move: "pingcheck",
                    target: target,
                    player,
                }
                if (player.hp < player.maxhp / 3 * 4 && player.magic >= 20 ) {
                    return {
                        type: "move",
                        move: "regen",
                        target: player,
                        player,
                    }
                }
                if (player.hp < player.maxhp / 2 && player.magic >= 30 ) {
                    return {
                        type: "move",
                        move: "heal",
                        target: player,
                        player,
                    }
                } else if (player.magic < 30 && Math.random() < 0.1) {
                    return {
                        type: "move",
                        move: bestmove,
                        target: target,
                        player,
                    }
                }
                return {
                    type: "move",
                    move: bestboost,
                    target: player,
                    player,
                }
                break;
            }
            case "the_cat": {
                var attackChance = 1 - (1 / calcMul(getBestStages()))
                if (player.damageBlockedInTurn) return {
                    type: "move",
                    move: "counter",
                    target: target,
                    player,
                }
                if (Math.random() < attackChance) {
                    if (Math.random() < 0.25) {
                        return {
                            type: "move",
                            move: bestrecoilmove,
                            target: target,
                            player,
                        }
                    }
                    return {
                        type: "move",
                        move: bestmove,
                        target: target,
                        player,
                    }
                }
                if (getBestStages() < 6) return {
                    type: "move",
                    move: bestriskboost,
                    target: player,
                    player,
                }
                return {
                    type: "move",
                    move: "protect",
                    target: player,
                    player,
                }
                break;
            }
            case "egg_lord": {
                if (!target.status.some(el => el.type == "toxic")) return {
                    type: "move",
                    move: "twitter",
                    target: target,
                    player,
                }
                var bestdefense = target.atk > target.spatk ? "def" : "spdef"
                var bestdefenseboost = (bestdefense == "def") ? "tonk" : "sptonk"
                if (getBestStages() < 2) {
                    return {
                        type: "move",
                        move: bestboost,
                        target: player,
                        player,
                    }
                } else {
                    var chance = 0.5
                    if (Math.max(player.statStages.atk, player.statStages.spatk)) chance = 0.75
                    if (Math.random() < chance) {
                        return {
                            type: "move",
                            move: bestmove,
                            target: target,
                            player,
                        }
                    }
                }
                return {
                    type: "move",
                    move: bestdefenseboost,
                    target: player,
                    player,
                }
                break;
            }
            default: {
                if (target) {
                    if (player.damageBlockedInTurn > player.maxhp / 6) {
                        return {
                            type: "move",
                            move: this.battle.isPve ? "release" : "counter",
                            target: target,
                            player,
                        }
                    }
                    if (Math.random() < 0.5 && !target.status.some(el => el.type == "poison")) return {
                        type: "move",
                        move: "twitter",
                        target: target,
                        player,
                    }
                    if (Math.random() < 0.75 && getBestStages() < 3) {
                        return {
                            type: "move",
                            move: bestboost,
                            target: player,
                            player: player,
                        }
                    }
                    if (Math.max(target.statStages.atk, target.statStages.spatk) > 2 && Math.random() < 0.4 && !player.protectTurns) {
                        return {
                            type: "move",
                            move: "protect",
                            target: player,
                            player: player,
                        }
                    }
                    if (getBestStages() < 0 && Math.random() < 0.75) {
                        if (Math.random() < 0.5) {
                            return {
                                type: "move",
                                move: bestboost,
                                target: player,
                                player: player,
                            }
                        }
                        return {
                            type: "move",
                            move: "protect",
                            target: player,
                            player: player,
                        }
                    }
                    if (getBestStages() < 3 || (getBestStages() < 3 && Math.random() < 0.25)) return {
                        type: "move",
                        move: bestriskboost,
                        target: player,
                        player: player,
                    }
                    if (getBestStages() > 1 && Math.random() < 0.25 && player.hp > player.maxhp * 0.75) {
                        return {
                            type: "move",
                            move: bestrecoilmove,
                            player: player,
                            target: target,
                        }
                    }
                    return {
                        type: "move",
                        move: bestmove,
                        player: player,
                        target: target,
                    }
                }
                return {
                    type: "move",
                    move: bestboost,
                    target: player,
                    player: player,
                }
                break;
            }
        }

    }
    constructor(battle: Battle) {
        this.battle = battle
    }
}
type TakeDamageType = "none" | Category
interface TakeDamageOptions {
    silent?: boolean,
    message?: LocaleString,
    inflictor?: Player,
    breakshield?: boolean,
    type?: TakeDamageType,
}
export class Battle extends EventEmitter {
    players: Player[] = []
    lobby: BattleLobby
    turn: number = 0
    actions: TurnAction[] = []
    logs: string[] = []
    get totalScore() {
        return this.players.reduce((prev, cur) => {
            if (!cur.user) return prev + 100
            return prev + getUser(cur.user).score
        }, 0)
    }
    ended: boolean = false
    botAI: BotAI
    isEnemy(player: Player, target: Player) {
        if (player == target) return false
        if (!this.hasTeams) return true
        return player.team != target.team
    }
    async infoMessage(channel: TextBasedChannel) {
        var b = this
        var humans = this.players.filter(el => el.team == 0)
        var bots = this.players.filter(el => el.team == 1)
        function getIcons(player: Player) {
            var icons = ""
            for (var s of player.status) {
                var icon = statusTypes.get(s.type)?.icon;
                if (s.duration <= 0) continue;
                if (!icon) continue;
                icons += icon;
            }
            if (player.bruh) icons += "⌃"
            return icons;
        }
        function playerInfo(p: Player) {
            if (p.dead) return `${Start}0;${FG_Gray}m🞨 ${p.name}${Reset}`
            let icons = getIcons(p)
            let barColor = "green"
            if (p.hp <= p.maxhp / 2) barColor = "yellow"
            if (p.hp <= p.maxhp / 4) barColor = "red"
            let str = `${Start}0;${FG_Gray}m${icons}${Reset}${p.name}` + "\n" +
                formatString(`[${barColor}]${bar(p.hp, p.maxhp, 10)}| ${xOutOfY(Math.floor(p.hp), Math.floor(p.maxhp), true)}`)
                if (p.charge || p.magic) { 
                    str += "\n"
                    if (p.charge) {
                        str += formatString(`[u]CHG[r] [red]${xOutOfY(p.charge, p.maxCharge, true)} `)
                    }
                    if (p.magic) {
                        str += formatString(`[u]MAG[r] [blue]${xOutOfY(p.magic, p.maxMagic, true)} `)
                    }
                }
            if (p.status.length > 0) {
                    str += "\n" + p.status.map(v => statusTypes.get(v.type)?.short || "UNKN").join(" ")
                }
            return str
        }
        var str = ""
        if (this.type != "team_match") {
            str = (this.isPve ? humans : b.players).map((el, i) => {
                var icons = getIcons(el)
                var str = `${icons}**${el.name}** \`${el.status.map(el => `${statusTypes.get(el.type)?.short}${el.duration.toString().padStart(2, " ")}`).join(" ") || "no"}\`` + `\n` +
                    `\`${Math.floor(el.hp / el.maxhp * 100).toString().padEnd(3)}% ${bar(el.hp, el.maxhp, 15)}${el.absorption > 0 ? `| T${el.absorptionTier} ${Math.floor(el.absorption / el.maxhp * 100).toString().padEnd(3)}% ${bar(el.absorption, el.maxhp, 5)}` : ""}\`` + `\n` +
                    `\`     ${xOutOfY(Math.floor(el.hp), Math.floor(el.maxhp))}\``
                if (el.hp > 0) {
                    if (el.charge || el.magic) { 
                        str += "\n"
                        if (el.charge) {
                            str += `\`CHG ${xOutOfY(el.charge, el.maxCharge)}\` `
                        }
                        if (el.magic) {
                            str += `\`MAG ${xOutOfY(el.magic, el.maxMagic)}\` `
                        }
                    }
                    var a = Object.entries(el.statStages).filter((el) => el[1] != 0).map(([k, v]) => `${k.toUpperCase().padEnd(6, " ")}×${calcMul(v).toFixed(1)}`)
                    if (a.length) {
                        str += `\n${a.join(" ")}`
                    }
                } else str = "||" + str + "||"
                return str
            }).join("\n\n") || "Empty"
        } else {
            let teams: Player[][] = []
            for (let p of this.players) {
                if (!teams[p.team]) teams[p.team] = []
                teams[p.team].push(p)
            }
            for (let i in teams) {
                let players = teams[i]
                str += formatString(`[${teamColors[i]}]Team ${teamNames[i]}[r]\n`)
                for (let p of players) {
                    str += "\n" + playerInfo(p) + "\n"
                }
                str += "—————————————————————\n"
            }
            str = `\`\`\`ansi\n${str}\n\`\`\``
        }
        var fields: EmbedFieldData[] = []
        if (this.isPve) {
            if (this.type == "boss") {
                fields.push({
                    name: "Boss",
                    value: bots.map((el, i) => {
                        let bossstr = `\`${getIcons(el)}${el.name.padEnd(7, " ")}` + "\n" + 
                        `${bar(el.hp, el.maxhp, 45)}` + "\n" + 
                        `${(el.hp / el.maxhp * 100).toFixed(1)}%` + "\n" + 
                        `${el.status.map(el => `${statusTypes.get(el.type)?.short}`).join(" ") || ""}\``
                        var a = Object.entries(el.statStages).filter((el) => el[1] != 0).map(([k, v]) => `${k.toUpperCase().padEnd(6, " ")} x${calcMul(v).toFixed(1)}`)
                        if (a.length) {
                            bossstr += `\n${a.join(" ")}`
                        }
                        return bossstr
                    }).join("\n\n") || "what",
                    inline: false,
                })
                fields.push({
                    name: "Players",
                    value: str,
                    inline: false,
                })
            } else {
                fields.push({
                    name: "Players",
                    value: str,
                    inline: true,
                })
                fields.push({
                    name: "Bots",
                    value: bots.map((el, i) => {
                        let str = `${getIcons(el)}\`${el.name.padEnd(8, " ")} ${xOutOfY(el.hp, el.maxhp)} (${Math.ceil(el.hp / el.maxhp * 100).toString().padEnd(3)}%) ${el.status.map(el => `${statusTypes.get(el.type)?.short}`).join(" ") || ""}\``
                        return str
                    }).join("\n") || "what",
                    inline: true
                })
            }
        }
        var msg = await channel.send({
            content: this.lobby?.users.map(el => el.toString()).join(" "),
            embeds: [
                {
                    
                    title: `funni`,
                    description: (this.isPve) ? `${bots.filter(el => el.hp > 0).length} Bots left` : str,
                    fields: [
                        ...fields,
                    ]
                },
                {
                    title: `Log`,
                    description: "```ansi" + "\n" + b.logs.slice(-35).join("\n").slice(-1900) + "\n```"
                }
            ],
            files: [new MessageAttachment(Buffer.from(b.logs.join("\n")), "log.ansi")]
        })
        return msg
    }
    type: BattleType
    constructor(lobby: BattleLobby) {
        super()
        this.lobby = lobby
        this.type = lobby.type
        this.botAI = new BotAI(this)
    }
    /**
     * Increases `player`'s `stat` stages by `stages` and shows the respective message if `silent` is false
     */
    statBoost(player: Player, stat: StatID, stages: number, silent = false) {
        if (stages == 0) return
        if (!silent && stat == "atk" && stages > 0) {
            player.charge += 5 + Math.floor(stages*5)
        }
        player.statStages[stat] += stages;
        if (silent) return
        if (stages > 0) {
            if (stages > 2) {
                this.log(getString("stat.change.rose.drastically", {player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "green")
            } else if (stages > 1) {
                this.log(getString("stat.change.rose.sharply", {player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "green")
            } else {
                this.log(getString("stat.change.rose", {player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }))
            }
        } else if (stages < 0) {
            if (stages < -2) {
                this.log(getString("stat.change.fell.severely", {player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "red")
            } else if (stages < -1) {
                this.log(getString("stat.change.fell.harshly", {player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }), "red")
            } else {
                this.log(getString("stat.change.fell", {player: player.toString(), stat: getString(("stat." + stat) as LocaleString) }))
            }
        }
    }
    /**
     * Increases `player`'s statStages by the stages set in `stats` and shows the respective messages if `silent` is false
     */
    multiStatBoost(player: Player, stats: { [x in StatID]?: number }, silent: boolean = false) {
        for (var k in stats) {
            this.statBoost(player, k as StatID, stats[k as StatID] as number, silent)
        }
    }
    fullLog: string[] = []
    log(str: string, color: LogColorWAccent = "white") {
        var prefix = " "
        this.fullLog.push(str)
        this.logs.push(formatString(str, color))
        this.emit("log", str)
    }
    logL(str: LocaleString, vars: Dictionary<any> | any[], color: LogColorWAccent = "white") {
        this.log(getString(str, vars), color)
    }
    sortActions() {
        return this.actions.sort((a, b) => b.player.stats.spd - a.player.stats.spd).sort((a, b) => getPriority(b) - getPriority(a))
    }
    checkActions() {
        this.botAI.update()
        for (var p of this.players) {
            if (!p.user) {
                this.addAction(this.botAI.getAction(p))
            }
        }
        var a = this.actions
        if (this.players.filter(el => el.hp > 0).every(pl => a.some(el => el.player.id == pl.id))) {
            this.sortActions()
            this.doActions()
            return true
        } else return false
    }
    takeDamage(user: Player, damage: number, silent: boolean = false, message: LocaleString = "dmg.generic", breakshield: boolean = false, inflictor?: Player) {
        if (user.hp <= 0) return false
        if (damage < 0) return this.heal(user, -damage, silent);
        if (breakshield && user.protect) {
            damage /= 4
            user.protect = false
            this.log(getString("dmg.breakthrough", { player: user.toString()}))
        } else if (user.protect) {
            user.damageBlocked += damage
            user.damageBlockedInTurn += damage
            this.log(getString("dmg.block", { player: user.toString(), damage: Math.floor(damage)}))
            return false
        }
        var mirror = user.helditems.find(el => el.id == "mirror")
        if (inflictor && mirror && !mirror.remove) {
            if (!breakshield) {
                var reflect = (mirror.durability ?? (mirror.durability = 100)) / 100 * 0.25
                var stats = Object.keys(user.statStages).slice(1)
                var stat = stats[Math.floor(Math.random() * stats.length)]
                if (mirror.durability >= 100) {
                    this.logL("item.mirror.perfect", { player: user.toString() })
                    reflect = 1
                    this.statBoost(user, stat as StatID, 1)
                } else {
                    if (Math.random() < 0.25) {
                        this.statBoost(user, stat as StatID, 1)
                    }
                }
                var dmg = Math.floor(Math.min(damage, user.maxhp * 0.75) * reflect)
                mirror.durability -= (damage / user.maxhp) * 200
                var mirrorMax = Math.floor(user.maxhp/2)
                var mirrorCur = Math.floor(mirror.durability / 100 * user.maxhp / 2)
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
        user.addEvent({ type: "damage", amount: damage, inflictor }, this.turn)
        if (damage == 0 && !silent) return this.logL("dmg.none", { player: user.toString() }, "unimportant")
        if (user.absorption > 0) {
            var reduction = Math.min(user.absorptionTier, 9)*0.1
            user.absorption -= damage * reduction;
            damage *= 1 - reduction;
            if (user.absorption <= 0) {
                user.absorptionTier = 1
                user.absorption = 0
            };
        }
        var ab = abilities.get(user.ability || "")
        if (ab?.damage) {
            ab.damage(this, user, damage, inflictor)
        }
        if (isNaN(damage)) return this.log(`Tried to deal NaN damage to ${user.name}`, "yellow")
        user.hp -= damage
        if (isNaN(user.hp)) user.hp = 0;

        user.damageTaken += damage
        if (!silent) this.log(getString(message, { player: user.toString(), damage: Math.floor(damage) + ""}), "red")
        var death = 0 - user.plotArmor
        if (user.hp <= death) {
            if (Math.random() < 0.05) {
                user.hp = death + 1
                this.logL(`dmg.rng`, { player: user.toString() })
                return true
            }
            if (user.hp < -user.maxhp + death) this.logL("dmg.overkill", { player: user.toString()}, "red")
            else this.log(getString("dmg.death", { player: user.toString()}), "red")
            user.hp = death
        }

        return true
    }
    takeDamageO(user: Player, damage: number, options: TakeDamageOptions = {}) {
        return this.takeDamage(user, damage, options.silent, (options.message || "dmg.generic") as LocaleString, options.breakshield, options.inflictor)
    }
    heal(user: Player, amount: number, silent: boolean = false, message: LocaleString = "heal.generic", overheal: boolean = false) {
        if (user.status.some((s) => s.type == "bleed")) return false
        if (user.hp >= user.maxhp * user.overheal && !overheal) return false
        if (user.dead) return false
        user.addEvent({ type: "heal", amount }, this.turn)
        let max = user.maxhp * user.overheal
        // Healing becomes less effective the higher above max HP the player is
        amount /= Math.max(Math.ceil(user.hp / user.maxhp), 1)
        var hp = Math.max(Math.min(max - user.hp, amount), 0)
        if (overheal) hp = amount;
        user.hp += hp
        if (!silent) this.log(getString(message, { player: user.toString(), AMOUNT: Math.floor(amount) + "" }), "green")
    }
    addAbsorption(user: Player, amount: number, tier: number = 1) {
        if (user.absorptionTier > tier) amount /= (user.absorptionTier - tier)/3 + 1
        user.absorption += Math.floor(amount)
        if (user.absorption > user.maxhp) {
            user.absorption = user.maxhp/3
            if (user.absorptionTier < 9) user.absorptionTier++
        }
        if (user.absorptionTier < tier) user.absorptionTier = tier
    }
    get isPve() {
        return this.type == "boss" || this.type == "pve"
    }
    get hasTeams() {
        return this.type == "boss" || this.type == "pve" || this.type == "team_match"
    }
    doAction(action: TurnAction) {
        switch (action.type) {
            case "move": {
                var move = moves.get(action.move)
                if (!move) return this.log(`What`)
                if (move.type != "protect") {
                    action.player.protectTurns = 0
                }
                this.log(getString("move.use", { player: action.player.toString(), MOVE: move.name }))
                let missed = rng.get01() > move.accuracy / 100
                if (missed) this.log(getString("move.miss"))
                let failed = !move.checkFail(this, action.player, action.target) || action.player.magic < move.requiresMagic || action.player.charge < move.requiresCharge 
                if (failed && !missed) this.log(getString("move.fail"))
                action.player.magic -= move.requiresMagic
                action.player.charge -= move.requiresCharge
                var supportTarget = action.player
                if (this.hasTeams) supportTarget = action.target
                if (move.targetSelf && (!this.hasTeams || action.target.team != action.player.team)) {
                    action.target = action.player
                }
                action.player.addEvent({ type: "move", move: action.move, failed: failed || missed, target: action.target }, this.turn)
                if (failed || missed) return
                let onUse = move.onUse
                if (onUse) {
                    onUse(this, action.player, action.target)
                } else if (move.type == "attack") {
                    var cat = move.category
                    var pow = move.getPower(this, action.player, action.target)
                    if(action.player.helditems.some(el => el.id == "category_swap")) {
                        if (cat == "physical") cat = "special"
                        else if (cat == "special") cat = "physical"
                        this.log(`The move is now ${cat} thanks to Category Swap`)
                    }
                    var damageMul = 1.5
                    var critChance = ((0.15 + Math.max(Math.min((action.player.spd - action.target.spd) / 100, 0.25), 0)) + (Math.random() / 10)) * move.critMul
                    if (cat == "physical") critChance *= 1.1
                    var atk = getATK(action.player, cat)
                    var def = getDEF(action.target, cat)
                    if (cat == "physical" && !move.requiresCharge) {
                        action.player.charge += Math.floor(pow / 60 * 10)
                    } else if (cat == "special" && !move.requiresMagic) action.player.magic += Math.floor(pow / 40 * 5)
                    var dmg = Math.ceil(calcDamage(pow, atk, def, action.player.level) * (0.85 + (Math.random() * (1 - 0.85))))
                    if (move.setDamage == "set") {
                        dmg = Math.floor(pow)
                    } else if (move.setDamage == "set-atkdef") {
                        dmg = Math.floor(pow * atk/def)
                    } else if (move.setDamage == "percent") {
                        dmg = Math.ceil(pow/100 * action.target.maxhp)
                    }
                    if (Math.random() < critChance) {
                        this.log(`A critical hit!`, "red")
                        dmg = Math.floor(dmg * damageMul)
                    }
                    this.takeDamageO(action.target, dmg, { 
                        breakshield: move.breakshield,
                        inflictor: action.player,
                        type: cat,
                    })
                } else if (move.type == "protect") {
                    if (rng.get01() > (1 / (action.player.protectTurns/3 + 1))) return this.log(getString("move.fail"))
                    action.player.protectTurns++
                    supportTarget.protect = true
                } else if (move.type == "heal") {
                    var pow = move.getPower(this, action.player, supportTarget) / 100
                    this.heal(supportTarget, Math.floor(supportTarget.maxhp * pow), false, undefined, move.overheal)
                } else if (move.type == "absorption") {
                    var pow = move.getPower(this, action.player, supportTarget) / 100
                    this.addAbsorption(supportTarget, Math.floor(supportTarget.maxhp * pow), move.absorptionTier)
                }
                if (move.requiresMagic <= 0 && move.type != "attack") action.player.magic += 10
                if (move.recoil) {
                    var recoilDmg = Math.ceil(action.player.maxhp * move.recoil)
                    this.takeDamage(action.player, recoilDmg, false, "dmg.recoil")
                }
                if (rng.get01() < move.userStatChance) {
                    for (var k in move.userStat) {
                        this.statBoost(action.player, k as StatID, move.userStat[k as StatID])
                    }
                }
                if (rng.get01() < move.targetStatChance) {
                    for (var k in move.targetStat) {
                        this.statBoost(action.target, k as StatID, move.targetStat[k as StatID])
                    }
                }
                for (var i of move.inflictStatus) {
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
        var sType = statusTypes.get(s)
        if (sType) {
            var a = u.status.find(el => el.type == s)
            var o = {
                type: s,
                turns: 0,
                inflictor: inf,
                duration: Math.floor(randomRange(sType.minDuration, sType.maxDuration))
            }
            if (a) {
                if (sType.upgradeTo) {
                    sType.end(this, u, a)
                    a.duration = 0;
                    return this.inflictStatus(u, sType.upgradeTo, inf)
                }
                a.duration = Math.max(a.duration, o.duration)
                return a
            }
            u.status.push(o)
            sType.start(this, u, o)
            return o
        }
    }
    doStatusUpdate(u: Player, s: Status) {
        var sType = statusTypes.get(s.type)
        if (sType) {
            sType.turn(this, u, s)
        }
        s.duration--
        s.turns++
    }
    lengthPunishmentsStart = 30
    turnLimit = 50
    doActions() {
        if (this.ended) return
        this.turn++
        this.logs = []
        this.log(`Turn ${this.turn}`)
        for (var u of this.players) {
            u.protect = false
        }
        for (var p of this.players) {
            if (p.hp <= 0) continue;
            var ab = abilities.get(p.ability || "")
            if (ab) {
                ab.turn(this, p)
            }
            for (var it of p.helditems) {
                if (it.id.startsWith("bruh_orb")) {
                    if (!p.bruh) {
                        p.bruh = it.id
                        var oldStats = {...p.stats}

                        var stat = it.id.slice("bruh_orb_".length)
                        
                        var hp    = 1.2
                        var atk   = 1.2
                        var def   = 1.2
                        var spatk = 1.2
                        var spdef = 1.2
                        var spd   = 1.2

                        if (stat) {
                            hp    = 1.15
                            atk   = 1.15
                            def   = 1.15
                            spatk = 1.15
                            spdef = 1.15
                            spd   = 1.15

                            if (stat == "hp") {
                                hp    += 0.6 - 0.15
                            }
                            if (stat == "attack") {
                                atk   += 0.6 - 0.15
                                spatk += 0.6 - 0.15
                                spd   += 0.22 - 0.15
                            }
                            if (stat == "defense") {
                                def   += 0.6 - 0.15
                                spdef += 0.6 - 0.15
                                hp    += 0.22 - 0.15
                            }
                        }
                        p.baseStats.hp    = Math.floor(p.baseStats.hp    * hp   )
                        p.baseStats.atk   = Math.floor(p.baseStats.atk   * atk  )
                        p.baseStats.def   = Math.floor(p.baseStats.def   * def  )
                        p.baseStats.spatk = Math.floor(p.baseStats.spatk * spatk)
                        p.baseStats.spdef = Math.floor(p.baseStats.spdef * spdef)
                        p.baseStats.spd   = Math.floor(p.baseStats.spd   * spd  )
                        p.updateStats(false)
                        var newStats = {...p.stats}
                        this.log(`${p.toString()}'s Bruh Orb is now active`, "red")
                        // for (var k in dif) {
                        //     this.log(`${k.toUpperCase().padEnd(6, " ")} ${oldStats[k].toString().padEnd(4, " ")} + ${dif[k].toString().padStart(4, " ")}`)
                        // }
                        p.helditems = p.helditems.filter(el => !el.id.startsWith("bruh_orb"))
                        this.inflictStatus(p, "bruh", p);
                    }
                    break
                }
                var type = items.get(it.id)
                if (type) {
                    type.turn(this, p, it)
                }
            }
            p.helditems = p.helditems.filter(el => !el.remove)
        }
        for (var a of this.actions) {
            try {
                if (a.player.hp <= 0) continue
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
            for (var s of u.status) {
                this.doStatusUpdate(u, s)
            }
            u.status = u.status.filter(el => {
                if (el.duration <= 0) {
                    statusTypes.get(el.type)?.end(this, u, el)
                }
                return el.duration > 0
            })
        }
        // Discourage stalling until the heat death of the universe by doing some stuff
        if (this.lengthPunishmentsStart > 0) {
            var start = this.lengthPunishmentsStart
            if (this.turn == start) {
                this.log(`Turn ${start} has been reached`, "red")
            }
            if (this.turn == start || this.turn == start + 2 || this.turn == start + 5) {
                for (var p of this.players) {
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
                for (var p of this.players) {
                    this.takeDamage(p, p.maxhp * (1/16 * (1 + ((this.turn - 25) / 2))), false, "dmg.generic", true)
                }
            }
        }
        var winner = this.players.find(el => el.hp > 0)
        var end = this.players.every(el => {
            if (el == winner) return true
            if (el.hp <= 0) return true
        })
        if (this.turn == this.turnLimit) {
            this.log(`The ${this.turnLimit} turn limit has been reached`, "red")
            this.log(`Who decided to stall for this long?`, "red")
            end = true
            winner = this.players.sort((a, b) => (b.hp / b.maxhp) - (a.hp / a.maxhp))[0]
        }

        if (this.isPve) {
            var playersWon = this.players.filter(el => el.team == 1).every(el => el.hp <= 0)
            var botsWon = this.players.filter(el => el.team == 0).every(el => el.hp <= 0)
            if (playersWon && botsWon) {
                this.emit("end", undefined)
            } else if (playersWon) {
                this.emit("end", "The Players")
            } else if (botsWon) {
                this.emit("end", "The Bots")
            }
            if (playersWon || botsWon) {
                this.ended = true
                return
            }
        }
        if (this.type == "team_match") {
            let teams: Player[][] = []
            for (let p of this.players) {
                if (!teams[p.team]) teams[p.team] = []
                teams[p.team].push(p)
            }
            let teamsLeft = teams.map((_, i) => i).filter(i => teams[i].some(p => p.hp > -p.plotArmor))
            if (teamsLeft.length <= 1) {
                if (teamsLeft.length == 1) this.emit("end", `Team ${teamNames[teamsLeft[0]]}`)
                else this.emit("end", undefined)
                this.ended = true
                return
            }
        }

        if (end) {
            this.emit("end", winner)
            this.ended = true
            return
        }
        this.emit("newTurn")
    }
    addAction(action: TurnAction) {
        if (action.player.hp <= 0) return
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