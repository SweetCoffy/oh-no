import { Collection, TextBasedChannel, User } from "discord.js"
import { Battle, Player, BattleType, isTeamMatch, BattleTypeInfo } from "./battle.js"
import { enemies } from "./enemies.js"
import { items } from "./helditem.js"
import { limitStats, presets } from "./stats.js"
import { getUser } from "./users.js"
import { Dictionary, getID, getMaxTotal, settings } from "./util.js"
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
interface UserJoinData {
    enemyPreset?: string,
    team?: number,
    nickname?: string,
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
    teamCount: number = 4
    isTeamMatch() {
        return isTeamMatch(this.type)
    }
    get flagsString() {
        return Object.entries(this._flags).filter(e => e[1]).map(e => e[0])
    }
    set flags(v: string | Dictionary<boolean>) {
        if (typeof v == "string") {
            for (let f in this._flags) {
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
        this.id = getID()
        lobbies.set(this.id, this)
        this.join(host)
        this.startedAt = Date.now()
    }
    delete() {
        lobbies.delete(this.id)
        for (let u of this.users) {
            getUser(u).lobby = undefined
        }
    }
    leave(user: User) {
        if (user.id == this.host.id) {
            throw new LeaveError(`The host of the lobby cannot leave, use .delete() instead`)
        }
        let u = this.users.findIndex(el => el.id == user.id)
        if (u == -1) throw new LeaveError(`Cannot leave a lobby the user is not in`)
        getUser(user).lobby = undefined
        this.users.splice(u, 1)
        if (this.battle) {
            let idx = this.battle.players.findIndex(el => el.user?.id == user.id)
            if (idx == -1) return
            this.battle.players.splice(idx, 1)
            this.battle.actions = this.battle.actions.filter(el => el.player.user?.id != user.id)
            this.battle.checkActions()
        }
    }
    difficulty: Difficulty = "medium"
    start(callStart = true) {
        this.battle = new Battle(this)
        if (this.isTeamMatch()) this._flags.T = true
        let l = this
        if (this.battle.on("end", (winner: Player) => {
            l.delete()
        }))
        this.started = true
        let i = 0;
        for (let u of this.users) {
            let play = new Player(u)
            play.level = this.level
            play.moveset = (getUser(u).moveset).slice(0, settings.maxMoves)
            play.helditems = (getUser(u).helditems || []).slice(0, settings.maxMoves).map(el => ({id: el}))
            play.ability = getUser(u).ability
            let e = this.usersE[i]
            play.baseStats = limitStats(play.baseStats, getMaxTotal({ ability: play.ability }))
            if (this.flags.E) {
                let preset = e.enemyPreset || "default"
                if (preset != "default" && enemies.get(preset)) {
                    //@ts-ignore
                    play.baseStats = {...enemies.get(e).stats}
                }
            }
            if (this.flags.T) {
                play.team = e.team ?? this.isTeamMatch() ? Math.floor(Math.random() * 4) : 0
            }
            play.updateStats()
            if (e.nickname) play._nickname = e.nickname;
            this.battle.players.push(play)
            i++
        }
        let it = items.map((el, k) => k)
        let levelPerPlayer = 0.1
        if (this.difficulty == "easy") levelPerPlayer = 0
        if (this.difficulty == "hard") levelPerPlayer = 0.2
        if (this.difficulty == "hell") levelPerPlayer = 0.35
        let allowedPresets = [...presets.keys()]
        if (this.type == "boss") {
            let exclude = ["tonk", "extreme-tonk", "default"]
            allowedPresets = allowedPresets.filter(el => !exclude.includes(el))
        }
        let b = allowedPresets.map(el => presets.get(el)?.stats)
        let perTeam = Math.floor(this.botCount + this.users.length) / this.teamCount
        let teams = new Array(this.teamCount).fill(0)
        for (let p of this.battle.players) {
            teams[p.team]++
        }
        for (let i = 0; i < this.botCount; i++) {
            let bot = new Player()
            bot.level = this.level
            if (this.type == "pve") {
                bot.level = Math.ceil(bot.level * 0.46)
                bot.team = 1;
            }
            if (this.isTeamMatch()) {
                bot.team = teams.findIndex((v) => v < perTeam || v <= 0)
                teams[bot.team]++
            }
            bot.baseStats = limitStats(bot.baseStats, getMaxTotal({ ability: bot.ability }))
            //@ts-ignore
            bot.baseStats = {...b[Math.floor(Math.random() * b.length)]}
            bot.updateStats()
            if (this.type == "boss") {
                if (i == 0) {
                    bot.team = 1
                    bot.level *= 1 + (levelPerPlayer * this.users.length)
                    bot.helditems.push({id: "bruh_orb"})
                    if (this.bossType) {
                        let enemy = enemies.get(this.bossType);
                        if (enemy) {
                            bot.baseStats = { ...enemy.stats }
                            bot.ability = enemy.ability;
                            bot.helditems = [...enemy.helditems||[]].map(el => ({ id: el }))
                            bot._nickname = enemy.name
                            bot.aiSettings = enemy.aiSettings ?? {}
                        }
                    }
                }
                else {
                    bot.team = 0
                }
            } else {
                for (let j = 0; j < 4; j++) {
                    bot.helditems.push({id: it[Math.floor(Math.random() * it.length)]})
                }
            }
            this.battle.players.push(bot)
        }
        if (this.flags.W) {
            for (let p of this.battle.players) {
                if (p.team == 0) p.team = 1;
                else if (p.team == 1) p.team = 0;
            }
        }
        if (callStart) {
            this.battle.start()
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
    let lobby = new BattleLobby(host, capacity, name, capacity)
    return lobby
}
export function findValidLobby(user?: User) {
    return lobbies.find(el => !el.ready && !el.started && el.users.length < el.capacity && el.host.id != user?.id)
}