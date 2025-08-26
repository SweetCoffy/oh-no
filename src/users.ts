import { User, Collection } from 'discord.js'
import { BattleLobby } from './lobby.js'
import { baseStats, Stats, StatPreset, getPreset, limitStats } from './stats.js'
import { ItemStack } from "./items.js"
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs"
import { experimental, getMaxTotal, settings } from './util.js'
import { client } from './index.js'
import { Enemy } from './enemies.js'
import { RogueGame } from './rogue_mode.js'
import { getLevelCap } from './unlocking.js'
export let data: any = {}

type TempData = {
    timeout: NodeJS.Timeout,
    expired: boolean,
    data: { [k: string]: any }
}

const tempData = new Collection<string, TempData>()

function reviver(k: string, v: any) {
    if (typeof v == "string" && v.startsWith("BigInt(") && v.endsWith(")")) return BigInt(v.slice("BigInt(".length, -1))
    return v
}

if (!existsSync("data/")) mkdirSync("data/")


export interface PresetList {
    [key: string]: StatPreset
}
export interface MoneyData<T> {
    points: T,
    gold: T,
    suns: T,
}
export interface UserInfo {
    user: User,
    lobby?: BattleLobby,
    baseStats: Stats,
    preset: string,
    presets: PresetList,
    money: MoneyData<bigint>,
    items: ItemStack[],
    lastWork: number,
    helditems: string[],
    unloadTimeout: NodeJS.Timeout | undefined,
    multiplier: bigint,
    banks: bigint,
    bankLimit: bigint,
    lastShop: string,
    showGrid: boolean,
    buildMode: boolean,
    viewx: number,
    viewy: number,
    lastCommand: number,
    level: number,
    xp: number,
    fuel: bigint,
    forceEncounter: Enemy[] | null,
    lastMessage: number,
    moveset: string[],
    movesetEnhance: number[],
    msgLvl_xp: number,
    msgLvl_messages: number,
    rank_xp: number,
    ability?: string,
    rogue?: RogueGame,
    lastUpdate: number,
    special: Dict<any>,
    unlockCache?: {
        level: number
        content: {}
    }
}
export interface UserSaveData {
    baseStats: Stats,
    preset: string,
    presets: PresetList,
    money: MoneyData<string>,
    items: { item: string, amount: string }[],
    helditems: string[],
    multiplier: string,
    banks: string,
    bankLimit: string,
    level: number,
    xp: number,
    moveset: string[],
    ability?: string,
    [key: string]: any,
}
export function applyPreset(user: User, presetId: string) {
    let u = getUser(user)
    let preset = getPreset(presetId, user)
    if (!preset) {
        return
    }
    u.baseStats = limitStats(preset.stats, getMaxTotal(preset))
    preset.stats = u.baseStats
    u.ability = preset.ability
    u.helditems = preset.helditems || []
    u.preset = presetId
}
export function getTempData(id: string, key?: string, defaultValue?: any) {
    if (!tempData.has(id)) {
        tempData.set(id, {
            data: {},
            expired: false,
            timeout: setTimeout(() => {
                clearTempData(id)
            }, 5 * 60 * 1000)
        })
    }
    let data = tempData.get(id) as TempData;
    data.timeout.refresh()
    if (!key) return data;
    if (!data.data[key]) data.data[key] = defaultValue
    return data.data[key]
}
function clearTempData(id: string) {
    let d = tempData.get(id);
    if (!d) return;
    tempData.delete(id)
    d.expired = true
}
const specialData: Collection<string, UserSpecialData<any>> = new Collection()
export class UserSpecialData<T extends {}> {
    id: string
    saveKeys: (keyof T)[]
    defaults: T
    constructor(id: string, defaults: T, saveKeys?: (keyof T)[]) {
        this.defaults = defaults
        this.id = id
        if (!saveKeys) saveKeys = Object.keys(defaults) as typeof this.saveKeys
        this.saveKeys = saveKeys
    }
    register(): typeof this {
        specialData.set(this.id, this)
        return this
    }
    getSave(sp: T) {
        let save: Partial<T> = {}
        for (let k of this.saveKeys) {
            save[k] = sp[k]
        }
        return save
    }
    get(u: UserInfo): T {
        let sp = u.special[this.id]
        if (!sp) {
            sp = u.special[this.id] = structuredClone(this.defaults)
            sp.__populated = true
        }
const defaultLevelCap = 10
        if (!sp.__populated) {
            sp.__populated = true
            let defaults = this.defaults
            for (let k in defaults) {
                if (!(k in sp)) {
                    if (typeof defaults[k] == "object") {
                        sp[k] = structuredClone(defaults[k])
                    } else {
                        sp[k] = defaults[k]
                    }
                }
            }
        }
        return sp as T
    }
}
export function getUserSaveData(info: UserInfo) {
    let m: any = {}
    for (let k in info.money) {
        //@ts-ignore
        m[k] = info.money[k] + ""
    }
    let obj = {
        baseStats: info.baseStats,
        preset: info.preset,
        presets: info.presets,
        money: m,
        items: info.items.map(el => ({item: el.item, amount: el.amount + "", data: el.data})),
        banks: info.banks + "",
        multiplier: info.multiplier + "",
        helditems: info.helditems,
        bankLimit: info.bankLimit + "",
        ownedTiles: [],
        level: info.level,
        xp: info.xp,
        msgLvl_xp: info.msgLvl_xp,
        msgLvl_messages: info.msgLvl_messages,
        moveset: info.moveset,
        movesetEnhance: info.movesetEnhance,
        rank_xp: info.rank_xp,
        ability: info.ability,
        lastUpdate: info.lastUpdate,
        special: {}
    }
    for (let k in info.special) {
        let i = specialData.get(k)
        if (!i) continue
        //@ts-ignore
        obj.special[k] = i.getSave(info.special[k])
    }
    return obj;
}
export interface GlobalData {
    itemStock: {
        [key: string]: number
    }
}
export let globalData: GlobalData = {
    itemStock: {

    }
}
if (existsSync("global.json")) {
    let g = JSON.parse(readFileSync("global.json", "utf8"), (k, v) => {
        if (typeof v == "string" && v.startsWith("BigInt:")) return BigInt(v.slice("BigInt:".length))
        return v
    })
    globalData = g || {}
}
export let users: Collection<string, UserInfo> = new Collection()
export function replacer(k: string, v: any) {
    if (typeof v == "bigint") return `BigInt(${v})`
    return v
}
export const UPDATE_TIME_INC = 1000
export const MAX_UPDATE_INCS = 120
export function saveUser(id: string, data: UserInfo) {
    writeFileSync(`data/${settings.saveprefix}${id}.json`, 
        JSON.stringify(getUserSaveData(data), replacer, 4))
}
export function getUser(user: User | string): UserInfo {
    if (typeof user == "string") {
        user = client.users.cache.get(user) as User
    }
    if (!users.get(user.id)) createUser(user)
    let data = users.get(user.id) as UserInfo;
    if (!data.unloadTimeout) {
        // Don't unload users that are in a lobby as it can cause "funny" things to happen
        data.unloadTimeout = setTimeout(function() {
            saveUser(user.id, data)
            if (data.lobby || data.rogue) {
                return data.unloadTimeout?.refresh()
            }
            data.unloadTimeout = undefined;
            users.delete((user as User).id);
            console.log(`User ${(user as User).username} has been unloaded`)
        }, settings.unloadTimeout)
    } else {
        data.unloadTimeout.refresh()
    }
    let now = Date.now()
    let timeDelta = now - data.lastUpdate
    if (timeDelta > UPDATE_TIME_INC) {
        let increments = Math.floor(timeDelta / UPDATE_TIME_INC)
        data.lastUpdate += increments * UPDATE_TIME_INC
        updateUser(user, data, Math.min(increments, MAX_UPDATE_INCS))
    }
    return data
}
export type TimestepUpdateFn = (u: User, d: UserInfo) => void
export type SingleUpdateFn = (u: User, d: UserInfo, increments: number) => void
const timestepUpdaters: { label: string, fn: TimestepUpdateFn }[] = []
const singleUpdaters: { label: string, fn: SingleUpdateFn }[] = []
export function addSingleUpdater(label: string, fn: SingleUpdateFn) {
    singleUpdaters.push({ label, fn })
}
export function addTimestepUpdater(label: string, fn: TimestepUpdateFn) {
    timestepUpdaters.push({ label, fn })
}
function updateUser(user: User, data: UserInfo, increments: number) {
    for (let i = 0; i < increments; i++) {
        for (let u of timestepUpdaters) {
            u.fn(user, data)
        }
    }
    for (let u of singleUpdaters) {
        u.fn(user, data, increments)
    }
}
export function level(user: User) {
    let u = getUser(user)
    return Math.floor(Math.cbrt(u.msgLvl_xp))
}
export function getLevelUpXP(user: User) {
    let u = getUser(user)
    let l = u.level + 1
    return Math.pow(l, 3) - Math.pow(l - 1, 3)
}
export function createUser(user: User) {
    let obj: UserInfo = {
        user,
        lobby: undefined,
        baseStats: {...baseStats},
        helditems: [],
        preset: "default",
        banks: 0n,
        lastWork: 0,
        unloadTimeout: undefined,
        money: {
            points: 3000n,
            gold: 0n,
            suns: 0n,
        },
        multiplier: 1n,
        items: [],
        presets: {},
        lastShop: "main",
        bankLimit: 100n,
        rank_xp: 0,
        showGrid: false,
        buildMode: false,
        viewx: 0,
        viewy: 0,
        lastCommand: Date.now(),
        level: 1,
        forceEncounter: null,
        xp: 0,
        fuel: 0n,
        lastMessage: Date.now(),
        moveset: ["bonk", "nerf_gun", "stronk", "spstronk", "protect"],
        movesetEnhance: [0, 0, 0, 0, 0],
        msgLvl_messages: 0,
        msgLvl_xp: 0,
        lastUpdate: Date.now(),
        special: {}
    }
    for (let [k, v] of specialData) {
        obj.special[k] = structuredClone(v.defaults)
    }
    if (existsSync(`data/${settings.saveprefix}${user.id}.json`)) {
        obj = {...obj, ...JSON.parse(readFileSync(`data/${settings.saveprefix}${user.id}.json`, "utf8"), reviver)}
    } else obj = {...obj, ...(data[user.id] || {})}
    for (let k in obj.money) {
        //@ts-ignore
        obj.money[k] = BigInt(obj.money[k])
    }
    obj.items = obj.items.map(el => {
        return {
            item: el.item,
            amount: BigInt(el.amount),
            data: el.data
        }
    })
    obj.banks = BigInt(obj.banks)
    obj.bankLimit = BigInt(obj.bankLimit)
    obj.multiplier = BigInt(obj.multiplier)
    users.set(user.id, obj)
}
export function addXP(user: User, amount: number) {
    if (experimental.april_fools) {
        amount << Math.floor(Math.cbrt(Math.random() * 50))
    }
    let u = getUser(user)
    let hunt = specialData.get("hunt")!.get(u) as { bossesDefeated: string[] }
    u.xp += amount
    let levels = 0;
    let cap = getLevelCap(hunt.bossesDefeated)
    while (u.xp >= getLevelUpXP(user)) {
        u.xp -= getLevelUpXP(user)
        levels++
        u.level++
        if (u.level >= cap) break;
    }
    return levels;
}
export function getRank(user: User) {
    return Math.floor(Math.cbrt(getUser(user).rank_xp/1.5) / 3.5) + 1
}
