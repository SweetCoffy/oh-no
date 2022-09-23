import { Collection, TextBasedChannel, User } from "discord.js"
import { Battle, Player, BattleType } from "./battle.js"
import { enemies } from "./enemies.js"
import { items } from "./helditem.js"
import { presets } from "./stats.js"
import { getUser, users } from "./users.js"
import { Dictionary, settings } from "./util.js"
export class JoinError extends Error {
    name = "JoinError"
    intended = true
}
export class LeaveError extends Error {
    name = "LeaveError"
    intended = true
}
export type Difficulty = "easy" | "medium" | "hard" | "hell"
export const lobbies: Collection<string, BattleLobby> = new Collection<string, BattleLobby>()
var bruhnum = 0
interface UserJoinData {
    enemyPreset?: string,
    team?: number,
}
export class BattleLobby {
    users: User[] = []
    usersE: UserJoinData[] = []
    needed: number = 2
    capacity: number = 2
    ready: boolean = false
    started: boolean = false
    battle: Battle | null = null
    host: User
    id: string
    name: string
    level: number = 1
    type: BattleType = "ffa"
    botCount: number = 0
    bossType?: string
    startedAt: number
    _flags: Dictionary<boolean> = { E: false, T: false, W: false }
    get flagsString() {
        return Object.entries(this._flags).filter(e => e[1]).map(e => e[0])
    }
    set flags(v: string | Dictionary<boolean>) {
        if (typeof v == "string") {
            for (var f in this._flags) {
                this._flags[f] = v.includes(f);
            }
        } else {
            this._flags = v;
        }
    }
    get flags(): Dictionary<boolean> {
        return this._flags;
    }
    constructor(host: User, needed = 2, name?: string, capacity?: number) {
        this.needed = needed
        this.host = host
        this.name = `${host.username}'s Lobby`
        if (name) this.name = name
        if (capacity != undefined) {
            this.capacity = capacity
        }
        this.id = `${(bruhnum = (bruhnum + 1) % 1000).toString().padStart(3, "0")}`
        lobbies.set(this.id, this)
        this.join(host)
        this.startedAt = Date.now()
    }
    delete() {
        lobbies.delete(this.id)
        for (var u of this.users) {
            getUser(u).lobby = undefined
        }
    }
    leave(user: User) {
        if (user.id == this.host.id) {
            throw new LeaveError(`The host of the lobby cannot leave, use .delete() instead`)
        }
        var u = this.users.findIndex(el => el.id == user.id)
        if (u == -1) throw new LeaveError(`Cannot leave a lobby the user is not in`)
        getUser(user).lobby = undefined
        this.users.splice(u, 1)
        if (this.battle) {
            var idx = this.battle.players.findIndex(el => el.user?.id == user.id)
            if (idx == -1) return
            this.battle.players.splice(idx, 1)
            this.battle.actions = this.battle.actions.filter(el => el.player.user?.id != user.id)
            this.battle.checkActions()
        }
    }
    difficulty: Difficulty = "medium"
    start() {
        this.battle = new Battle(this)
        var l = this
        if (this.battle.on("end", (winner: Player) => {
            l.delete()
        }))
        this.started = true
        var i = 0;
        for (var u of this.users) {
            var play = new Player(u)
            play.level = this.level
            play.moveset = (getUser(u).moveset).slice(0, settings.maxMoves)
            play.helditems = (getUser(u).helditems || []).slice(0, settings.maxMoves).map(el => ({id: el}))
            play.ability = getUser(u).ability
            var e = this.usersE[i]
            if (this.flags.E) {
                var preset = e.enemyPreset || "default"
                if (preset != "default" && enemies.get(preset)) {
                    //@ts-ignore
                    play.baseStats = {...enemies.get(e).stats}
                }
            }
            if (this.flags.T) {
                play.team = e.team || 0
            }
            play.updateStats()
            this.battle.players.push(play)
            i++
        }
        var it = items.map((el, k) => k)
        var levelPerPlayer = 0.125
        if (this.difficulty == "easy") levelPerPlayer = 0.125/2
        if (this.difficulty == "hard") levelPerPlayer = 0.17
        if (this.difficulty == "hell") levelPerPlayer = 0.23
        var allowedPresets = [...presets.keys()]
        if (this.type == "boss") {
            var exclude = ["tonk", "extreme-tonk", "default"]
            allowedPresets = allowedPresets.filter(el => !exclude.includes(el))
        }
        var b = allowedPresets.map(el => presets.get(el)?.stats)
        for (var i = 0; i < this.botCount; i++) {
            var bot = new Player()
            bot.level = this.level
            if (this.type == "pve") {
                bot.level = Math.ceil(bot.level * 0.46)
                bot.team = 1;
            }
            if (this.type == "boss") {
                bot.level *= 1 + (levelPerPlayer * this.users.length)
                this.battle.statBoost(bot, "atk", 1);
                this.battle.statBoost(bot, "def", 1);
                this.battle.statBoost(bot, "spatk", 1);
                this.battle.statBoost(bot, "spdef", 1);
                bot.helditems.push({id: "bruh_orb"});
                bot.team = 1;
            } else {
                for (var j = 0; j < 4; j++) {
                    bot.helditems.push({id: it[Math.floor(Math.random() * it.length)]})
                }
            }
            //@ts-ignore
            bot.baseStats = {...b[Math.floor(Math.random() * b.length)]}
            if (this.bossType) {
                var enemy = enemies.get(this.bossType);
                if (enemy) {
                    bot.baseStats = {...enemy.stats}
                    bot._nickname = enemy.name
                    bot.ai = enemy.ai
                }
            }
            bot.updateStats()
            this.battle.players.push(bot)
        }
        for (var p of this.battle.players) {
            p.helditems = [...new Set(p.helditems.map(el => el.id))].map(el => ({id: el}))
        }
        if (this.flags.W) {
            for (var p of this.battle.players) {
                if (p.team == 0) p.team = 1;
                else if (p.team == 1) p.team = 0;
            }
        }
    }
    channels: TextBasedChannel[] = []
    join(user: User, e?: UserJoinData, channel?: TextBasedChannel) {
        if (this.users.some(el => el.id == user.id)) throw new JoinError(`The user ${user.username} (${user.id}) is already in the lobby`)
        if (getUser(user).lobby) throw new JoinError(`The user ${user.username} is already in a lobby`)
        if (this.users.length >= this.capacity) throw new JoinError(`The lobby has reached it's maximum capacity`)
        this.users.push(user)
        //@ts-ignore
        this.usersE.push(e || {  })
        if (channel) {
            if (!this.channels.some(el => el.id == channel.id)) this.channels.push(channel)
        }
        getUser(user).lobby = this
    }
}
export function createLobby(host: User, name?: string, capacity: number = 2) {
    var lobby = new BattleLobby(host, capacity, name, capacity)
    return lobby
}
export function findValidLobby(user?: User) {
    return lobbies.find(el => !el.ready && !el.started && el.users.length < el.capacity && el.host.id != user?.id)
}