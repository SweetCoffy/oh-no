import { Collection, User } from "discord.js"
import { Battle, Player } from "./battle.js"
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
    botCount: number = 0
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
            console.log(getUser(u))
            play.helditems = (getUser(u).helditems || []).slice(0, 4).map(el => ({id: el}))
            console.log(play.helditems)
            play.updateStats()
            this.battle.players.push(play)
        }
        var b = presets.map(el => el.stats)
        var it = items.map((el, k) => k)
        for (var i = 0; i < this.botCount; i++) {
            var bot = new Player()
            bot.level = this.level
            bot.baseStats = b[Math.floor(Math.random() * b.length)]
            for (var j = 0; j < 4; j++) {
                bot.helditems.push({id: it[Math.floor(Math.random() * it.length)]})
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