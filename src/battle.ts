import { User, Collection, TextChannel, Message } from "discord.js"
import { EventEmitter } from "events"
import { setKeys, rng, randomRange, bar } from "./util.js"
import { makeStats, calcStats, Stats, baseStats } from "./stats.js"
import { moves, Category } from "./moves.js"
import { lobbies, BattleLobby } from "./lobby.js"
import { getString, Locales, LocaleString } from "./locale.js"
import { getUser } from "./users.js"
import { HeldItem, items } from "./helditem.js"

export function calcDamage(pow: number, atk: number, def: number, level: number) {
    return Math.floor((((2 * level) / 5 + 2) * pow * atk/def) / 50 + 2);
}
export interface CategoryStats {
    atk: string,
    def: string,
}
export class StatusType {
    name: string
    short: string
    minDuration = 3
    maxDuration = 5
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
    constructor(name: string, short?: string, onStart?: StatusCallback, onTurn?: StatusCallback, onEnd?: StatusCallback) {
        this.name = name
        this.short = short || name
        this.onStart = onStart
        this.onTurn = onTurn
        this.onEnd = onEnd
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
var statusTypes: Collection<string, StatusType> = new Collection()
statusTypes.set("poison", new StatusType("Poison", "PSN", statusMessageEffect("status.poison.start"), 
statusDamageEffect(1/16, false, "dmg.poison")))
statusTypes.set("toxic", new StatusType("Bad Poison", "TOX", statusMessageEffect("status.toxic.start"), 
function (b, p, s) {
    var percent = 1/16 * (1 + (s.turns/3))
    b.takeDamage(p, p.stats.hp * percent, false, "dmg.poison")
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
    if (stages > 0) return Math.min(1 + (stages / 6 * 3), 4   )
    if (stages < 0) return Math.max(1 + (stages / 8    ), 0.25)
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
    private _charge: number = 0
    private _magic: number = 0
    maxCharge: number = 100
    maxMagic: number = 100
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
                    target: target,
                    player: player,
                }
            }
            if (Math.max(target.statStages.atk, target.statStages.spatk) > 2 && Math.random() < 0.4 && !player.protectTurns) {
                return {
                    type: "move",
                    move: "protect",
                    target: target,
                    player: player,
                }
            }
            if (getBestStages() < 0 && Math.random() < 0.75) {
                if (Math.random() < 0.5) {
                    return {
                        type: "move",
                        move: bestboost,
                        target: target,
                        player: player,
                    }
                }
                return {
                    type: "move",
                    move: "protect",
                    target: target,
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
            if (getBestStages() > 2 && target.hp < target.stats.hp && Math.random() < 0.3) {
                return {
                    type: "move",
                    move: "shield_breaker",
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
            target: target,
            player: player,
        }
    }
    constructor(battle: Battle) {
        this.battle = battle
    }
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
    async infoMessage(channel: TextChannel) {
        var b = this
        var msg = await channel.send({
            embeds: [
                {
                    title: `funni`,
                    description: b.players.map((el, i) => {
                        var str = `\`#${i}\` **${el.name}** ${Math.floor(el.hp)}/${Math.floor(el.stats.hp)}` + `\n` +
                        `\`[${bar(el.hp, el.stats.hp, 20)}]\` ${(el.hp / el.stats.hp * 100).toFixed(1)}%`
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
                        return str
                    }).join("\n") || "Empty",
                    fields: [
                        {
                            name: "Logs",
                            value: "```diff\n" + b.logs.slice(-20).join("\n") + "\n```"
                        }
                    ]
                }
            ]
        })
        return msg
    }
    constructor(lobby: BattleLobby) {
        super()
        this.lobby = lobby
        this.botAI = new BotAI(this)
    }
    statBoost(player: Player, stat: string, stages: number, silent = false) {
        player.statStages[stat] += stages;
        if (silent) return
        if (stages > 0) {
            if (stages > 1) {
                this.log(getString("stat.change.rose.sharply", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }), "green")
            } else {
                this.log(getString("stat.change.rose", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }))
            }
        } else if (stages < 0) {
            if (stages < -1) {
                this.log(getString("stat.change.fell.harshly", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }), "red")
            } else {
                this.log(getString("stat.change.fell", { USER: player.name, STAT: getString(("stat." + stat) as LocaleString) }))
            }
        }
    }
    log(str: string, type: "red" | "green" | "white" = "white") {
        var prefix = " "
        if (type == "red") prefix = "-"
        if (type == "green") prefix = "+"
        this.logs.push(prefix + str)
        this.emit("log", str)
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
    takeDamage(user: Player, damage: number, silent: boolean = false, message: LocaleString = "dmg.generic", breakshield: boolean = false) {
        if (user.hp <= 0) return false
        if (damage > user.stats.hp && user.protect) breakshield = true
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
        user.hp -= damage
        user.damageTaken += damage
        if (!silent) this.log(getString(message, {USER: user.name, DAMAGE: Math.floor(damage) + ""}), "red")
        if (user.hp <= 0) {
            user.hp = 0
            this.log(getString("dmg.death", {USER: user.name}), "red")
        }
        return true
    }
    heal(user: Player, amount: number, silent: boolean = false, message: LocaleString = "heal.generic") {
        if (user.hp >= user.stats.hp) return false
        var hp = Math.max(Math.min(user.stats.hp - user.hp, amount), 0)
        user.hp += hp
        if (!silent) this.log(getString(message, {USER: user.name, AMOUNT: Math.floor(amount) + ""}), "green")
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
                if (!move.checkFail(this, action.player, action.target)) return this.log(getString("move.fail"))
                if (move.type == "attack") {
                    var atk = getATK(action.player, move.category)
                    var def = getDEF(action.target, move.category)
                    var pow = move.getPower(this, action.player, action.target)
                    var dmg = calcDamage(pow, atk, def, action.player.level)
                    this.takeDamage(action.target, dmg, false, "dmg.generic", move.breakshield)
                    if (move.recoil) {
                        var recoilDmg = Math.ceil(action.player.stats.hp * move.recoil)
                        this.takeDamage(action.player, recoilDmg, false, "dmg.recoil")
                    }
                } else if (move.type == "protect") {
                    if (rng.get01() > (1 / (action.player.protectTurns + 1))) return this.log(getString("move.miss"))
                    action.player.protectTurns++
                    action.player.protect = true
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
            var o = {
                type: s,
                turns: 0,
                inflictor: inf,
                duration: Math.floor(randomRange(sType.minDuration, sType.maxDuration))
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
            for (var it of p.helditems) {
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
                this.log(`Turn 25 has been reached, everyone will now take damage each turn`, "red")
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
        this.checkActions()
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