import { Collection, User } from "discord.js"
import { Battle, Player, BattleType } from "./battle.js"
import { enemies } from "./enemies.js"
import { items } from "./helditem.js"
import { presets } from "./stats.js"
import { getUser, users } from "./users.js"
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
export class BattleLobby {
    users: User[] = []
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
    constructor(host: User, needed = 2, name?: string, capacity?: number) {
        this.needed = needed
        this.host = host
        this.name = `${host.username}'s Lobby or something idfk'`
        if (name) this.name = name
        if (capacity != undefined) {
            this.capacity = capacity
        }
        this.id = `${(bruhnum++).toString().padStart(3, "0")}`
        lobbies.set(this.id, this)
        this.join(host)
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
        for (var u of this.users) {
            var play = new Player(u)
            play.level = this.level
            play.moveset = (getUser(u).moveset).slice(0, 4)
            play.helditems = (getUser(u).helditems || []).slice(0, 4).map(el => ({id: el}))
            
            play.updateStats()
            this.battle.players.push(play)
        }
        var it = items.map((el, k) => k)
        var levelPerPlayer = 50
        if (this.difficulty == "easy") levelPerPlayer = 25
        if (this.difficulty == "hard") levelPerPlayer = 65
        if (this.difficulty == "hell") levelPerPlayer = 100
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
                bot.level = Math.ceil(bot.level * 0.6)
            }
            if (this.type == "boss") {
                bot.level += levelPerPlayer * this.users.length
                this.battle.statBoost(bot, "atk", 1);
                this.battle.statBoost(bot, "def", 1);
                this.battle.statBoost(bot, "spatk", 1);
                this.battle.statBoost(bot, "spdef", 1);
                bot.helditems.push({id: "bruh_orb"});
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
    }
    join(user: User) {
        if (getUser(user).lobby) throw new JoinError(`The user ${user.username} is already in a lobby`)
        if (this.users.some(el => el.id == user.id)) throw new JoinError(`The user ${user.username} (${user.id}) is already in the lobby`)
        if (this.users.length >= this.capacity) throw new JoinError(`The lobby has reached it's maximum capacity`)
        this.users.push(user)
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