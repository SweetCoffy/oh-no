import { UserInfo } from "./users"
//import { Dictionary, settings } from "./util"
//import type { Ability } from "./abilities"
//import type { HeldItemType } from "./helditem"
//import type { Move } from "./moves"
import { Collection } from "discord.js"
export type UnlockMeta = { unlockLevel?: number, name: string }
export const unlockContent: {
    [x in string]: Collection<string, UnlockMeta>
} = {
    
}
const bossLevelCap: Dict<number> = {
    egg_lord: 20,
    the_sun: 120
}
const defaultLevelCap = 10
let maxMoves = 9999
let leftoverMp = 1
type AvailableContent = {
    [x in keyof typeof unlockContent]: Set<string>
}
export function getLevelCap(bosses: string[]) {
    return Math.max(defaultLevelCap, ...bosses.map(b => bossLevelCap[b] ?? 0))
}
export function getAvailableContentForLevel(level: number): AvailableContent {
    let c: AvailableContent = {}
    for (let k in unlockContent) {
        c[k] = new Set(unlockContent[k].filter(v => level >= (v.unlockLevel ?? 0)).keys())
    }
    return c
}
export function getAvailableContent(u: UserInfo): AvailableContent {
    if (!u.unlockCache || u.unlockCache.level != u.level) {
        u.unlockCache = {
            level: u.level,
            content: getAvailableContentForLevel(u.level)
        }
    }
    return u.unlockCache.content
}
export function getBaseMpForLevel(level: number) {
    let maxMp = maxMoves + leftoverMp
    let minMp = 2
    return Math.min(minMp + Math.floor(level/80 * (maxMp - minMp)), maxMp)
}
export function getBaseMp(info: UserInfo) {
    return getBaseMpForLevel(info.level)
}
queueMicrotask(async() => {
    const moves = await import("./moves")
    const abilities = await import("./abilities")
    const helditem = await import("./helditem")
    const util = await import("./util")
    unlockContent.moves = moves.moves
    unlockContent.abilities = abilities.abilities
    unlockContent.items = helditem.items
    maxMoves = util.settings.maxMoves
    leftoverMp = util.settings.leftoverMp
})