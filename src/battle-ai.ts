import { Battle, Player } from "./battle";
type AIAction = {
    target: Player,
    move: string
}
export class BotAI {
    constructor(readonly battle: Battle, readonly player: Player) {

    }
    getAction(): AIAction {
        return {
            move: "bonk",
            target: this.player
        }
    }
}