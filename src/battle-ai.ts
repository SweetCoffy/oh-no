import { Battle, calcDamage, Player } from "./battle.js";
import { moves } from "./moves.js";
import { calcStat } from "./stats.js";
type AIAction = {
    target: Player,
    move: string
}
export type BotAISettings = {
    attackMult?: number
    supportMult?: number
    selfSupportMult?: number
}
export class BotAI {
    attackMult: number
    supportMult: number
    selfSupportMult: number
    constructor(readonly battle: Battle, readonly player: Player, settings: BotAISettings = {}) {
        this.attackMult = settings.attackMult ?? 1
        this.supportMult = settings.supportMult ?? 1
        this.selfSupportMult = settings.selfSupportMult ?? 1.5
    }
    getAllies() {
        let p = this.player
        let b = this.battle
        return this.battle.players.filter(other => p != other && !b.isEnemy(p, other))
    }
    getEnemies() {
        let p = this.player
        let b = this.battle
        return this.battle.players.filter(other => b.isEnemy(p, other) && !p.dead)
    }
    getThreatMultiplier(t: Player): number {
        let highestAtk = Math.max(
            calcDamage(t.cstats.atk, this.player.cstats.def, t.level),
            calcDamage(t.cstats.spatk, this.player.cstats.spdef, t.level),
        ) / this.player.maxhp
        return highestAtk
    }
    rankMove(move: string, t: Player): number {
        let info = moves.get(move)
        if (!info) return Number.NEGATIVE_INFINITY
        if (this.player.magic < info.requiresMagic) return -999
        if (this.player.charge < info.requiresCharge) return -999
        if (this.player == t) {
            return info.getAiSupportRank(this.battle, this.player, t) * this.selfSupportMult
        }
        let score = -99
        if (this.battle.isEnemy(this.player, t)) 
            score = info.getAiAttackRank(this.battle, this.player, t) * this.attackMult * this.getThreatMultiplier(t)
        if (!this.battle.isEnemy(this.player, t)) 
            score = info.getAiSupportRank(this.battle, this.player, t) * this.supportMult
        let hpLost = Math.min((info.recoil * t.maxhp) / t.hp, 1)
        return score * (1 - hpLost)
    }
    getAction(): AIAction {
        let ai = this
        let options = this.player.moveset.flatMap(move => ai.battle.players.map(target => {
            return {
                move,
                target,
                score: ai.rankMove(move, target)
            }
        }))
        let filtered = options.filter(v => !isNaN(v.score))
        if (filtered.length == 0) filtered = options
        filtered.sort((a, b) => b.score - a.score)
        console.log(this.player.name)
        console.log(filtered.map(v => `${v.move} -> ${v.target.toString()}: ${v.score}`))
        return filtered[0]
    }
}