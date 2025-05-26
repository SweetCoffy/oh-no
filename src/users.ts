import { User, Collection } from 'discord.js'
import { BattleLobby } from './lobby.js'
import { baseStats, Stats, StatPreset, getPreset, limitStats } from './stats.js'
import { ItemStack } from "./items.js"
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs"
import { experimental, getMaxTotal, settings } from './util.js'
import { client } from './index.js'
import { Enemy } from './enemies.js'
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
    msgLvl_xp: number,
    msgLvl_messages: number,
    rank_xp: number,
    ability?: string,
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
        console.log(`created temp data ${id}`)
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
    console.log(`cleared temp data ${id}`)
    tempData.delete(id)
    d.expired = true
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
        rank_xp: info.rank_xp,
        ability: info.ability,
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
export function getUser(user: User | string): UserInfo {
    if (typeof user == "string") {
        user = client.users.cache.get(user) as User
    }
    if (!users.get(user.id)) createUser(user)
    let data = users.get(user.id) as UserInfo;
    if (!data.unloadTimeout) {
        // Don't unload users that are in a lobby as it can cause "funny" things to happen
        data.unloadTimeout = setTimeout(function() {
            if (data.lobby) return data.unloadTimeout?.refresh()
            data.unloadTimeout = undefined;
            writeFileSync(`data/${settings.saveprefix}${(user as User).id}.json`, JSON.stringify(getUserSaveData(data), replacer, 4))
            users.delete((user as User).id);
            console.log(`User ${(user as User).username} has been unloaded`)
        }, settings.unloadTimeout)
    } else {
        data.unloadTimeout.refresh()
    }
    return data
}
export function level(user: User) {
    let u = getUser(user)
    return Math.floor(Math.cbrt(u.msgLvl_xp))
}
export function getLevelUpXP(user: User) {
    let u = getUser(user)
    let l = u.level + 1
    return (l * l * l) - ((l-1) * (l-1) * (l-1))
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
        msgLvl_messages: 0,
        msgLvl_xp: 0,
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
    u.xp += amount
    let levels = 0;
    while (u.xp >= getLevelUpXP(user)) {
        u.xp -= getLevelUpXP(user)
        levels++
        u.level++
    }
    return levels;
}
export function getRank(user: User) {
    return Math.floor(Math.cbrt(getUser(user).rank_xp/1.5) / 3.5) + 1
}
