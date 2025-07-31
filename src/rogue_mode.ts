import { codeBlock, Collection, SendableChannels, User } from "discord.js";
import { ItemID, MoveID, RogueItemID } from "./gen";
import { baseStats, calcStats, makeStats, Stats } from "./stats";
import { Battle, Player } from "./battle";
import { BattleLobby, createLobby } from "./lobby";
import { getUser } from "./users";
import { fnum } from "./number-format";
import { End, FG_Blue, Reset, Start } from "./ansi";
import { moves } from "./moves";
export const rogueItems = new Collection<RogueItemID, RogueItemType>()
export type RogueRarity = 1 | 2 | 3 | 4 | 5
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
        p.id = this.user.id
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
export type RogueItemResult = { msg: string, status: "success" | "fail" }
export class RogueItemType {
    description: string = ""
    lore: string = ""
    usable: boolean = false
    consumable: boolean = false
    autoDescription(): string {
        return ""
    }
    use(plr: RoguePlayer): RogueItemResult {
        return {
            msg: "impossible",
            status: "fail"
        }
    }
    constructor(public name: string, public icon: string) {
        this.description = this.autoDescription()
    }
}
function success(msg: string): RogueItemResult {
    return {
        msg,
        status: "success"
    }
}
function fail(msg: string): RogueItemResult {
    return {
        msg,
        status: "fail"
    }
}
function tfmt(strings: TemplateStringsArray, ...values: any[]) {
    let final = ""
    for (let i = 0; i < strings.length; i++) {
        final += strings[i]
        let v = values[i]
        if (typeof v == "number") {
            v = fnum(v)
        }
        final += `${Start}${FG_Blue}${End}${v}${Reset}`
    }
    return final
}
export class RogueMoveLearnItem extends RogueItemType {
    move: MoveID = "bonk"
    autoDescription(): string {
        let info = moves.get(this.move)
        return tfmt`Item used to learn the move ${info?.name}.`
    }
    use(plr: RoguePlayer): RogueItemResult {
        if (plr.moveset.length >= plr.moveLimit) return fail("You can't learn any more moves.")
        if (plr.moveset.includes(this.move)) return fail("You already know this move.")
        plr.moveset.push(this.move)
        let info = moves.get(this.move)
        return success(tfmt`You learned ${info?.name}.`)
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
    startBattle(enemies: Player[] = []) {
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
        for (let e of enemies) {
            e.team = 1
            lobby.battle.players.push(e)
        }
        let battle = lobby.battle
        battle.lengthPunishmentsStart = 999
        battle.on("turn", () => {
            for (let c of game.channels) {
                battle.infoMessage(c)
            }
        })
        battle.on("end", (winner) => {
            game.battleEnded(battle, winner == "Team Blue")
        })
        battle.start()
    }
    battleEnded(b: Battle, won: boolean) {
        if (!won) {
            // TODO: game over stuff
            return
        }
        for (let battlePlayer of b.players) {
            if (!battlePlayer.user) continue
            let player = this.players.find(v => v.user.id == battlePlayer.id)
            if (!player) continue
            player.applyPlayer(battlePlayer)
        }
    }
    infoMessage(): string {
        let str = `Money: ${fnum(this.money)}`
        return codeBlock("ansi", str)
    }
    constructor() {
        this.players = []
        this.inventory = []
        this.channels = []
    }
}