import type { Collection } from "discord.js"
import type { BattleType } from "./battle"
import type { ExtendedStats, Stats } from "./stats"

export type WorkerMsg = { type: "generate", id: string, battle: PartialBattle } |
{ type: "result", id: string, buf: ArrayBuffer }
export type PartialBattle = {
    players: PartialPlayer[],
    type: BattleType,
    isPve: boolean,
    logs: string[],
    turn: number
}
export type PartialStatusType = {
    name: string,
    short: string,
    fillStyle: string,
}
export type PartialInfo = {
    statusType: [string, PartialStatusType][],
    teamNames: string[],
}
export type PartialPlayer = {
    hp: number,
    prevHp: number,
    prevAbsorb: number,
    dmgBlocked: number,
    absorb: number,
    stats: ExtendedStats,
    cstats: ExtendedStats,
    status: { type: string, turnsLeft: number, duration: number }[],
    team: number,
    level: number,
    name: string,
    magic: number,
    charge: number,
    dead: boolean,
    vaporized: boolean,
}