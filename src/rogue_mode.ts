import { SendableChannels, User } from "discord.js";
import { ItemID, MoveID } from "./gen";
import { baseStats, calcStats, makeStats, Stats } from "./stats";
import { Battle, Player } from "./battle";
import { BattleLobby, createLobby } from "./lobby";
import { getUser } from "./users";
export class RoguePlayer {
    user: User
    level: number
    xp: number
    baseStats: Stats
    stats: Stats
    hp: number
    moveLimit: number = 4
    moveset: MoveID[]
    constructor(user: User, level: number) {
        this.user = user
        this.level = level
        this.xp = 0
        this.level = 1
        this.baseStats = {...baseStats}
        this.stats = makeStats()
        this.recalculateStats()
        this.hp = this.stats.hp
        this.moveset = ["bonk", "nerf_gun", "protect"]
    }
    createPlayer(): Player {
        let p = new Player(this.user)
        p.baseStats = {...this.baseStats}
        p.level = this.level
        p.helditems = []
        p.moveset = []
        p.updateStats()
        p.recalculateStats()
        p.hp = this.hp
        p.team = 0
        return p
    }
    xpToNext(): number {
        return Math.pow(this.level, 2) * 10
    }
    addXp(xp: number): number {
        this.xp += xp
        let levels = 0
        let nextXp = 0
        while (this.xp >= (nextXp = this.xpToNext())) {
            this.xp -= nextXp
            this.level++
            levels++
        }
        return levels
    }
    applyPlayer(p: Player) {
        this.hp = Math.ceil(p.hp / p.maxhp * this.stats.hp)
        this.moveset = [...p.moveset] as MoveID[]

    }
    recalculateStats() {
        this.stats = calcStats(this.level, this.baseStats)
    }

}
export class RogueRoom {
    exits: RogueRoom[]
    constructor() {
        this.exits = []
    }
}
export class RogueGame {
    players: RoguePlayer[]
    inventory: ItemID[]
    money: number = 0
    lobby?: BattleLobby
    inBattle: boolean = false
    channels: SendableChannels[]
    addXp(xp: number): number[] {
        let divided = Math.ceil(xp / this.players.length)
        return this.players.map(p => p.addXp(divided))
    }
    startBattle() {
        let players = this.players.map(p => p.createPlayer())
        for (let plr of this.players) {
            let u = getUser(plr.user)
            if (u.lobby) {
                u.lobby.leave(plr.user)
            }
        }
        this.inBattle = true
        let game = this
        let lobby = createLobby(this.players[0].user)
        for (let plr of this.players) {
            if (plr.user.id == lobby.host.id) continue
            lobby.join(plr.user)
        }
        lobby.channels = this.channels
        lobby.type = "team_match"
        this.lobby = lobby
        lobby.start(false)
        if (!lobby.battle) throw new Error("this is impossible")
        lobby.battle.players = [...players]
        lobby.battle.start()
    }
    constructor() {
        this.players = []
        this.inventory = []
        this.channels = []
    }
}