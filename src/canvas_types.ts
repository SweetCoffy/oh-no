import type { BattleType } from "./battle"
import type { Stats } from "./stats"

export type WorkerMsg = { type: "generate", id: string, battle: PartialBattle } |
{ type: "result", id: string, buf: ArrayBuffer }
export type PartialBattle = {
    players: PartialPlayer[],
    type: BattleType,
    isPve: boolean,
    logs: string[],
    turn: number
}
export type PartialPlayer = {
    hp: number,
    prevHp: number,
    absorb: number,
    stats: Stats,
    cstats: Stats,
    status: { type: string, turnsLeft: number }[],
    team: number,
    level: number,
    name: string,
    magic: number,
    charge: number
}