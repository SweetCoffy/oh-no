import { User, Collection, TextChannel, Message, TextBasedChannels, EmbedFieldData } from "discord.js"
import { EventEmitter } from "events"
import { setKeys, rng, randomRange, bar, experimental } from "./util.js"
import { makeStats, calcStats, Stats, baseStats } from "./stats.js"
import { moves, Category } from "./moves.js"
import { lobbies, BattleLobby } from "./lobby.js"
import { getString, LocaleID, Locales, LocaleString } from "./locale.js"
import { getUser } from "./users.js"
import { HeldItem, items } from "./helditem.js"
import { enemies } from "./enemies.js"
import { FG_Blue, FG_Gray, FG_Green, FG_Red, FG_White, FG_Yellow, P, R, S } from "./ansi.js"

export type BattleType = "ffa" | "pve" | "boss"
export function calcDamage(pow: number, atk: number, def: number, level: number) {
    return Math.floor((((2 * level) / 5 + 2) * pow * atk/def) / 50 + 2);
}
export interface CategoryStats {
    atk: string,
    def: string,
}
export type BotAIType = "normal" | "egg_lord" | "the_cat" | "u";
export class StatusType {
    name: string
    short: string
    minDuration = 3
    maxDuration = 5
    upgradeTo?: string
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
}
type StatusCallback = (b: Battle, p: Player, s: Status) => any
function statusDamageEffect(percent: number, silent = false, message: LocaleString = "dmg.generic"): StatusCallback {
    return function(b, p, s) {
        b.takeDamage(p, p.stats.hp * percent, silent, message)
    }
}
function statusMessageEffect(message: LocaleString): StatusCallback {
    return function(b, p, s) {
        b.log(getString(message, {USER: p.name, INFLICTOR: s.inflictor?.name}))
    }
}
export var statusTypes: Collection<string, StatusType> = new Collection()
statusTypes.set("poison", new StatusType("Poison", "POISN", statusMessageEffect("status.poison.start"), 
function (b, p, s) {
    var tox = p.status.find(el => el.type == "toxic")
    if (tox) {
        
        return
    }
    var base = 1/16
    if (b.type == "pve" && p.user) {
        base = 1/24
    }
    
    b.takeDamage(p, p.stats.hp * base, false, "dmg.poison")
}, undefined, "toxic"))
statusTypes.set("toxic", new StatusType("Toxic", "TOXIC", statusMessageEffect("status.toxic.start"), 
function (b, p, s) {
    var base = 1/16
    if (b.type == "pve" && p.user) {
        base = 1/24
    }
    if (p.status.some(el => el.type == "poison")) {
        base += 1/64
    }
    var percent = base * (1 + (s.turns/3))
    b.takeDamage(p, p.stats.hp * percent, false, "dmg.poison")
}, undefined, "california"))
statusTypes.set("california", new StatusType("California", "CALIF", statusMessageEffect("status.toxic.start"), 
function (b, p, s) {
    var base = 1/8
    if (b.type == "pve" && p.user) {
        base = 1/12
    }
    if (p.status.some(el => el.type == "poison")) {
        base += 1/32
    }
    if (p.status.some(el => el.type == "toxic")) {
        base += 1/16
    }
    var percent = base * (1 + (s.turns/5))
    b.takeDamage(p, p.stats.hp * percent, false, "dmg.poison")
}, undefined))
statusTypes.set("regen", new StatusType("Regeneration", "REGEN", undefined, function(b, p, s) {
    if (p.status.some(el => el.type == "strong_regen")) {
        return
    }
    var base = 1/8
    b.heal(p, Math.ceil(p.stats.hp * base))
}, undefined, "strong_regen"))
statusTypes.set("strong_regen", new StatusType("Strong Regeneration", "SRGEN", undefined, function(b, p, s) {
    var base = 1/8 * (1 + s.turns / 5)
    if (p.status.some(el => el.type == "regen")) {
        base += 1/16
    }
    b.heal(p, Math.ceil(p.stats.hp * base))
}, undefined, "stronger_regen"))
statusTypes.set("stronger_regen", new StatusType("Stronger Regeneration", "SRRGN", undefined, function(b, p, s) {
    var base = 1/8 * (1 + s.turns / 5)
    if (p.status.some(el => el.type == "regen")) {
        base += 1/16
    }
    b.heal(p, Math.ceil(p.stats.hp * base))
}, undefined))
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
type LogColor = "red" | "green" | "white" | "gray" | "blue" | "yellow"
function colorToANSI(color: LogColor) {
    if (color == "red")    return FG_Red
    if (color == "green")  return FG_Green
    //if (color == "white")  return FG_White
    if (color == "gray")   return FG_Gray
    if (color == "blue")   return FG_Blue
    if (color == "yellow") return FG_Yellow
    return 0
}
/**
 * Represents an in-battle player
 */
export class Player {
    /** The player's current HP */
    hp: number = 0
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
    bruh: boolean = false
    private _charge: number = 0
    private _magic: number = 0
    maxCharge: number = 100
    maxMagic: number = 100
    moveset: string[] = ["bonk", "nerf_gun", "stronk", "spstronk"]
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
    /** The player's true stats */
    stats: Stats = makeStats()
    /** The player's base stats, usually taken from their preset */
    baseStats: Stats = baseStats
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
    ai: BotAIType = "normal"
    xpYield: number = 0

    /** The player's current Attack stat, but with stat modifiers taken into account */
    get atk()   { return this.stats.atk * calcMul(this.statStages.atk)     }
    /** The player's current Defense stat, but with stat modifiers taken into account */
    get def()   { return this.stats.def * calcMul(this.statStages.def)     }
    /** The player's current Special Attack stat, but with stat modifiers taken into account */
    get spatk() { return this.stats.spatk * calcMul(this.statStages.spatk) }
    /** The player's current Special Defense stat, but with stat modifiers taken into account */
    get spdef() { return this.stats.spdef * calcMul(this.statStages.spdef) }
    /** The player's current Speed stat, but with stat modifiers taken into account */
    get spd()   { return this.stats.spd * calcMul(this.statStages.spd)     }
    
    get name() {
        if (this._nickname) return this._nickname
        if (this.user) return this.user.username
        return `Bot-${this.id}`
    }
    set name(v: string) {
        this._nickname = v
    }
    _nickname = ""
    updateStats() {
        var lastmax = this.stats.hp
        setKeys(calcStats(this.level, this.baseStats), this.stats)
        var max = this.stats.hp
        this.hp += max - lastmax
    }
    constructor(user?: User) {
        if (user) {
            this.user = user
            this.baseStats = {...getUser(user).baseStats}
        }
        this.id = "" + curnum++
        this.stats = makeStats()
        this.updateStats()
        this.hp = this.stats.hp
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
class BotAI {
    battle: Battle
    target?: Player
    update() {
        var target = this.battle.players.find(el => el.hp > 0 && el.user)
        if (!target) target = this.battle.players.find(el => el.hp > 0)
        this.target = target
    }
    getAction(player: Player): TurnAction {
        if (player.hp < player.stats.hp / 4 && player.helditems.some(el => el.id == "eggs")) {
            return {
                type: "item",
                item: "eggs",
                player: player,
            }
        }
        var targets = this.battle.players.filter(el => el.id != player.id)
        if (this.battle.type == "pve") {
            targets = targets.filter(el => el.user)
        }
        var target = targets[Math.floor(targets.length * Math.random())]

        var bestboost = player.atk > player.spatk ? "stronk" : "spstronk"
        var beststat = player.atk > player.spatk ? "atk" : "spatk"
        var bestmove = player.atk > player.spatk ? "bonk" : "nerf_gun"
        var bestrecoilmove = player.atk > player.spatk ? "slap" : "ping"
        function getBest() {
            return Math.max(player.atk, player.spatk)
        }
        function getBestStages() {
            return player.atk > player.spatk ? player.statStages.atk : player.statStages.spatk
        }
        switch (player.ai) {
            case "u": {
                if (this.battle.turn == 0 || player.hp < player.stats.hp / 4) return {
                    type: "move",
                    move: "destruction_beam",
                    target: target,
                    player,
                }
                if (player.hp < player.stats.hp / 3 * 4 && player.magic >= 20 ) {
                    return {
                        type: "move",
                        move: "regen",
                        target: player,
                        player,
                    }
                }
                if (player.hp < player.stats.hp / 2 && player.magic >= 30 ) {
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
                return {
                    type: "move",
                    move: bestboost,
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
                    if (Math.random() < 0.5 && !target.status.some(el => el.type == "poison")) return {
                        type: "move",
                        move: "twitter",
                        target: target,
                        player,
                    }
                    if (player.damageBlockedInTurn > player.stats.hp / 6) {
                        return {
                            type: "move",
                            move: "counter",
                            target: target,
                            player,
                        }
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
                    if (getBestStages() > 1 && Math.random() < 0.25 && player.hp > player.stats.hp * 0.75) {
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
interface TakeDamageOptions {
    silent?: boolean,
    message?: LocaleString,
    inflictor?: Player,
    breakshield?: boolean,
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
    async infoMessage(channel: TextBasedChannels) {
        var b = this
        var humans = this.players.filter(el => el.user)
        var bots = this.players.filter(el => !el.user)
        var str = ((this.isPve || this.type == "boss") ? humans : b.players).map((el, i) => {
            var str = `\`#${i}\` ${el.bruh ? "<:ohno:737474912666648688> " : ""}**${el.name}** ${Math.floor(el.hp)}/${Math.floor(el.stats.hp)} \`${el.status.map(el => `[${statusTypes.get(el.type)?.short}|${el.duration.toString().padStart(2, " ")}]`).join(" ") || "no"}\`` + `\n` +
            `\`[${bar(el.hp, el.stats.hp, 20)}]\` ${(el.hp / el.stats.hp * 100).toFixed(1)}%`
            if (el.hp > 0) {
                if (el.charge) {
                    str += `\n\`CHG [${bar(el.charge, el.maxCharge, 15)}] ${el.charge.toString().padEnd(3, " ")}/${el.maxCharge.toString().padEnd(3, " ")}\``
                }
                if (el.magic) {
                    str += `\n\`MAG [${bar(el.magic, el.maxMagic, 15)}] ${el.magic.toString().padEnd(3, " ")}/${el.maxMagic.toString().padEnd(3, " ")}\``
                }
                var a = Object.entries(el.statStages).filter((el) => el[1] != 0).map(([k, v]) => `${k.toUpperCase().padEnd(6, " ")} x${calcMul(v).toFixed(1)}`)
                if (a.length) {
                    str += `\n[ ${a.join(" | ")} ]`
                }
            } else str = "||" + str + "||"
            return str
        }).join("\n\n") || "Empty"
        function subscriptNum(num: number | string) {
            var str = num + ""
            return [...str].map(el => String.fromCharCode(el.charCodeAt(0) + 8272)).join("")
        }
        var fields: EmbedFieldData[] = []
        if (this.isPve) {
            if (this.type == "boss") {
                fields.push({
                    name: "Boss",
                    value: bots.map((el, i) => {
                        let str = `\`#${(i + humans.length).toString().padEnd(2, " ")} ${el.name.padEnd(7, " ")}` + "\n" + 
                        `[${bar(el.hp, el.stats.hp, 45)}]` + "\n" + 
                        `${(el.hp / el.stats.hp * 100).toFixed(1)}%` + "\n" + 
                        `${el.status.map(el => `${statusTypes.get(el.type)?.short}`).join(" ") || ""}\``
                        if (el.bruh) str = "<:ohno:737474912666648688> " + str
                        var a = Object.entries(el.statStages).filter((el) => el[1] != 0).map(([k, v]) => `${k.toUpperCase().padEnd(6, " ")} x${calcMul(v).toFixed(1)}`)
                        if (a.length) {
                            str += `\n[ ${a.join(" | ")} ]`
                        }
                        return str
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
                        let str = `\`#${(i + humans.length).toString().padEnd(2, " ")} ${el.name.padEnd(7, " ")} [${bar(el.hp, el.stats.hp, 10)}] ${el.status.map(el => `${statusTypes.get(el.type)?.short}`).join(" ") || ""}\``
                        if (el.bruh) str = "<:ohno:737474912666648688> " + str
                        return str
                    }).join("\n") || "what",
                    inline: true
                })
            }
        }
        var msg = await channel.send({
            embeds: [
                {
                    
                    title: `funni`,
                    description: (this.isPve) ? `${bots.filter(el => el.hp > 0).length} Bots left` : str,
                    fields: [
                        ...fields,
                        {
                            name: "Logs",
                            value: "```" + (experimental.ansi_logs ? "ansi" : "diff") + "\n" + b.logs.slice(-20).join("\n") + "\n```"
                        }
                    ]
                }
            ]
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
    statBoost(player: Player, stat: string, stages: number, silent = false) {
        if (stages == 0) return
        if (stat == "hp") {
            this.heal(player, stages / 6 * player.stats.hp, false, "heal.generic", true)
            return
        }
        if (!silent && stat == "attack" && stages > 0) {
            player.charge += 5 + Math.ceil(stages / (1 + stages*0.1))
        }
        player.statStages[stat] += stages;
        if (silent) return
        if (stages > 0) {
            if (stages > 2) {
                this.log(getString("stat.change.rose.drastically", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }), "green")
            } else if (stages > 1) {
                this.log(getString("stat.change.rose.sharply", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }), "green")
            } else {
                this.log(getString("stat.change.rose", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }))
            }
        } else if (stages < 0) {
            if (stages < -2) {
                this.log(getString("stat.change.fell.severely", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }), "red")
            } else if (stages < -1) {
                this.log(getString("stat.change.fell.harshly", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }), "red")
            } else {
                this.log(getString("stat.change.fell", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }))
            }
        }
    }
    log(str: string, color: LogColor = "white") {
        var prefix = " "
        if (experimental.ansi_logs) {
            prefix = `${P}0;`
            prefix += colorToANSI(color)
            prefix += "m"
            str = str.replace(/\[(\w+)\]/g, function(substr, format: string) {
                if (format == "reset") return R;
                return `${P}0;${colorToANSI(format as LogColor)}m`
            })
            this.logs.push(prefix + str + R)
            this.emit("log", str)
        } else {
            if (color == "red" || color == "yellow") prefix = "-"
            if (color == "green" || color == "blue") prefix = "+"
            str = str.replace(/\[(\w+)\]/g, "")
            this.logs.push(prefix + str)
            this.emit("log", str)
        }
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
            this.log(getString("dmg.breakthrough", {USER: user.name}))
        } else if (user.protect) {
            user.damageBlocked += damage
            user.damageBlockedInTurn += damage
            this.log(getString("dmg.block", {USER: user.name, DAMAGE: Math.floor(damage)}))
            return false
        }
        var mirror = user.helditems.find(el => el.id == "mirror")
        if (inflictor && mirror && !mirror.remove) {
            if (!breakshield) {
                var reflect = (mirror.durability ?? (mirror.durability = 100)) / 100 * 0.25
                var stats = Object.keys(user.statStages).slice(1)
                var stat = stats[Math.floor(Math.random() * stats.length)]
                if (mirror.durability >= 100) {
                    this.log(`${user.name}'s Perfect Mirror`)
                    reflect = 0.69
                    this.statBoost(user, stat, 1)
                } else {
                    if (Math.random() < 0.25) {
                        this.statBoost(user, stat, 1)
                    }
                }
                var dmg = Math.floor(Math.min(damage, user.stats.hp * 0.75) * reflect)
                mirror.durability -= (damage/user.stats.hp) * 200
                this.log(`${inflictor.name} Took ${dmg} damage from ${user.name}'s Mirror! [${bar(mirror.durability, 100, 5)}]`, "red")
                this.takeDamage(inflictor, dmg, true, "dmg.generic", false)
                damage = Math.floor(damage * (1 - reflect))
            } else mirror.durability = 0;
            //@ts-ignore
            if (mirror?.durability <= 0) {
                this.log(`${user.name}'s Mirror broke!`)
                this.statBoost(user, "def", -1)
                this.statBoost(user, "spdef", -1)
                mirror.remove = true
                this.takeDamage(user, user.stats.hp/16)
            }
        }
        if (damage == 0 && !silent) return this.log(`${user.name} Took no damage!`)
        user.hp -= damage
        user.damageTaken += damage
        if (!silent) this.log(getString(message, {USER: user.name, DAMAGE: Math.floor(damage) + ""}), "red")
        if (user.hp <= 0) {
            user.hp = 0
            if (Math.random() < 0.05) {
                user.hp = 1
                this.log(`${user.name} Endured the hit thanks to shitty rng mechanics!`)
                return true
            }
            this.log(getString("dmg.death", {USER: user.name}), "red")
        }

        return true
    }
    takeDamageO(user: Player, damage: number, options: TakeDamageOptions = {}) {
        return this.takeDamage(user, damage, options.silent, (options.message || "dmg.generic") as LocaleString, options.breakshield, options.inflictor)
    }
    heal(user: Player, amount: number, silent: boolean = false, message: LocaleString = "heal.generic", overheal: boolean = false) {
        if (user.hp >= user.stats.hp && !overheal) return false
        var hp = Math.max(Math.min(user.stats.hp - user.hp, amount), 0)
        if (overheal || amount > user.stats.hp) hp = amount;
        user.hp += hp
        if (!silent) this.log(getString(message, {USER: user.name, AMOUNT: Math.floor(amount) + ""}), "green")
    }
    get isPve() {
        return this.type == "boss" || this.type == "pve"
    }
    doAction(action: TurnAction) {
        switch (action.type) {
            case "move": {
                var move = moves.get(action.move)
                if (!move) return this.log(`What`)
                if (move.type != "protect") {
                    action.player.protectTurns = 0
                }
                this.log(getString("move.use", {USER: action.player.name, MOVE: move.name}))
                if (rng.get01() > move.accuracy / 100) return this.log(getString("move.miss"))
                if (!move.checkFail(this, action.player, action.target) || action.player.magic < move.requiresMagic || action.player.charge < move.requiresCharge) return this.log(getString("move.fail"))
                action.player.magic -= move.requiresMagic
                action.player.charge -= move.requiresCharge
                var supportTarget = action.player
                if (this.isPve) supportTarget = action.target
                if (move.targetSelf && !this.isPve) {
                    action.target = action.player
                }
                if (move.type == "attack") {
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
                        action.player.charge += Math.floor(pow / 40 * 5)
                    } else if (cat == "special" && !move.requiresMagic) action.player.magic += Math.floor(pow / 40 * 5)
                    var dmg = Math.ceil(calcDamage(pow, atk, def, action.player.level) * (0.85 + (Math.random() * (1 - 0.85))))
                    if (move.setDamage == "set") {
                        dmg = Math.floor(pow)
                    } else if (move.setDamage == "set-atkdef") {
                        dmg = Math.floor(pow * atk/def)
                    } else if (move.setDamage == "percent") {
                        dmg = Math.ceil(pow/100 * action.target.stats.hp)
                    }
                    if (Math.random() < critChance) {
                        this.log(`A critical hit!`, "red")
                        dmg = Math.floor(dmg * damageMul)
                    }
                    this.takeDamageO(action.target, dmg, { 
                        breakshield: move.breakshield,
                        inflictor: action.player,
                    })
                } else if (move.type == "protect") {
                    if (rng.get01() > (1 / (action.player.protectTurns + 1))) return this.log(getString("move.miss"))
                    action.player.protectTurns++
                    supportTarget.protect = true
                } else if (move.type == "heal") {
                    var pow = move.getPower(this, action.player, supportTarget) / 100
                    this.heal(supportTarget, Math.floor(supportTarget.stats.hp * pow))
                } else {
                    action.player.magic += 10
                }
                if (move.recoil) {
                    var recoilDmg = Math.ceil(action.player.stats.hp * move.recoil)
                    this.takeDamage(action.player, recoilDmg, false, "dmg.recoil")
                }
                if (rng.get01() < move.userStatChance) {
                    for (var k in move.userStat) {
                        this.statBoost(action.player, k, move.userStat[k])
                    }
                }
                if (rng.get01() < move.targetStatChance) {
                    for (var k in move.targetStat) {
                        this.statBoost(action.target, k, move.targetStat[k])
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
    inflictStatus(u: Player, s: string, inf?: Player) {
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
                    this.inflictStatus(u, sType.upgradeTo, inf);
                    return
                }
                a.duration = Math.max(a.duration, o.duration)
                return
            }
            u.status.push(o)
            sType.start(this, u, o)
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
        this.log(`Turn ${this.turn}`)
        for (var u of this.players) {
            for (var s of u.status) {
                this.doStatusUpdate(u, s)
            }
            u.status = u.status.filter(el => {
                if (el.duration <= 0) {
                    statusTypes.get(el.type)?.end(this, u, el)
                }
                return el.duration > 0
            })
            u.protect = false
        }
        for (var p of this.players) {
            if (p.hp <= 0) continue;
            for (var it of p.helditems) {
                if (it.id.startsWith("bruh_orb")) {
                    if (!p.bruh) {
                        p.bruh = true
                        var oldStats = {...p.stats}

                        var stat = it.id.slice("bruh_orb_".length)
                        

                        p.baseStats.hp    += Math.floor(p.baseStats.hp    * 0.3)
                        p.baseStats.atk   += Math.floor(p.baseStats.atk   * 0.3)
                        p.baseStats.def   += Math.floor(p.baseStats.def   * 0.3)
                        p.baseStats.spatk += Math.floor(p.baseStats.spatk * 0.3)
                        p.baseStats.spdef += Math.floor(p.baseStats.spdef * 0.3)
                        p.baseStats.spd   += Math.floor(p.baseStats.spd   * 0.3)

                        if (stat) {
                            p.baseStats.hp    -= Math.floor(p.baseStats.hp    * 0.15)
                            p.baseStats.atk   -= Math.floor(p.baseStats.atk   * 0.15)
                            p.baseStats.def   -= Math.floor(p.baseStats.def   * 0.15)
                            p.baseStats.spatk -= Math.floor(p.baseStats.spatk * 0.15)
                            p.baseStats.spdef -= Math.floor(p.baseStats.spdef * 0.15)
                            p.baseStats.spd   -= Math.floor(p.baseStats.spd   * 0.15)

                            if (stat == "hp") {
                                p.baseStats.hp    += Math.floor(p.baseStats.hp    * 0.6)
                            }
                            if (stat == "attack") {
                                p.baseStats.atk      += Math.floor(p.baseStats.atk    * 0.6)
                                p.baseStats.spatk    += Math.floor(p.baseStats.spatk    * 0.6)
                            }
                            if (stat == "defense") {
                                p.baseStats.def      += Math.floor(p.baseStats.def    * 0.6)
                                p.baseStats.spdef    += Math.floor(p.baseStats.spdef    * 0.6)
                            }
                        }
                        p.updateStats()
                        var newStats = {...p.stats}
                        var dif = makeStats()
                        for (var k in dif) {
                            dif[k] = newStats[k] - oldStats[k]
                        }
                        this.log(`${p.name}'s Bruh Orb is now active`, "red")
                        for (var k in dif) {
                            this.log(`${k.toUpperCase().padEnd(6, " ")} ${oldStats[k].toString().padEnd(4, " ")} + ${dif[k].toString().padStart(4, " ")}`)
                        }
                        p.helditems = []
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

        // Discourage stalling until the heat death of the universe by doing some stuff
        if (this.lengthPunishmentsStart > 0) {
            var start = this.lengthPunishmentsStart
            if (this.turn == start) {
                this.log(`Turn ${start} has been reached`, "red")
            }
            if (this.turn == start || this.turn == start + 2 || this.turn == start + 5) {
                for (var p of this.players) {
                    this.statBoost(p, "atk", 2)
                    this.statBoost(p, "spatk", 2)
    
                    this.statBoost(p, "def", -2)
                    this.statBoost(p, "spdef", -2)
                }
            }
            if (this.turn == start + 5) {
                this.log(`Turn ${start + 5} has been reached, everyone will now take damage each turn`, "red")
            }
            if (this.turn >= start + 5) {
                for (var p of this.players) {
                    this.takeDamage(p, p.stats.hp * (1/16 * (1 + ((this.turn - 25) / 2))), false, "dmg.generic", true)
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
            winner = this.players.sort((a, b) => (b.hp / b.stats.hp) - (a.hp / a.stats.hp))[0]
        }

        if (this.isPve || this.type == "boss") {
            var playersWon = this.players.filter(el => !el.user).every(el => el.hp <= 0)
            var botsWon = this.players.filter(el => el.user).every(el => el.hp <= 0)
            if (playersWon && botsWon) {
                this.emit("end", undefined)
            } else if (playersWon) {
                this.emit("end", "players")
            } else if (botsWon) {
                this.emit("end", "bots")
            }
            if (playersWon || botsWon) {
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