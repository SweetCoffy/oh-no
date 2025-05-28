import { Battle, Player } from "./battle";
type AIAction = {
    target: Player,
    move: string
}
export class BotAI {
    constructor(readonly battle: Battle, readonly player: Player) {

    }
    getAllies() {
        let p = this.player
        let b = this.battle
        return this.battle.players.filter(other => !b.isEnemy(p, other))
    }
    getEnemies() {
        let p = this.player
        let b = this.battle
        return this.battle.players.filter(other => b.isEnemy(p, other))
    }
    getAction(): AIAction {
        return {
            move: "bonk",
            target: this.player
        }
    }
}