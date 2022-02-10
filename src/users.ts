import { User, Collection } from 'discord.js'
import { BattleLobby } from './lobby.js'
import { baseStats, Stats, getPreset, getPresetList, StatPreset } from './stats.js'
import { ItemStack, ItemType } from "./items.js"
import { writeFileSync, existsSync, readFileSync } from "fs"
import { BitArray, BitArray2D, experimental } from './util.js'
import { map } from './game-map.js'
import { client } from './index.js'
import { Enemy } from './enemies.js'
import { deserialize } from './serialize.js'
export var data: any = {}

/*if (false || experimental.bin_save) {
    if (existsSync("userdata.bin")) {
        data = deserialize(readFileSync("userdata.bin"))
    }
} else */{
    if (!existsSync("users.json")) {
        writeFileSync("users.json", "{}")
    }
    data = JSON.parse(readFileSync("users.json", "utf8"), function(k, v) {
        if (typeof v == "string" && v.startsWith("BigInt(") && v.endsWith(")")) return BigInt(v.slice("BigInt(".length, -1))
        return v
    })
}
for (var k in data) {
    var owned = data[k].ownedTiles || []
    for (var t of owned) {
        var str = t.split(",")
        var x = Number(str[0])
        var y = Number(str[1])
        var tile = map.get(x, y)
        if (tile) tile.owner = k
    }
}
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
    score: number,
    money: MoneyData<bigint>,
    items: ItemStack[],
    lastWork: number,
    helditems: string[],
    multiplier: bigint,
    banks: bigint,
    bankLimit: bigint,
    lastShop: string,
    selection: BitArray2D,
    showGrid: boolean,
    buildMode: boolean,
    viewx: number,
    viewy: number,
    lastCommand: number,
    level: number,
    xp: number,
    modified?: boolean,
    fuel: bigint,
    forceEncounter: Enemy[] | null,
    lastMessage: number,
    moveset: string[],
    msgLvl_xp: number,
    msgLvl_messages: number,
    rank_xp: number,
}
export interface UserSaveData {
    baseStats: Stats,
    preset: string,
    presets: PresetList,
    score: number,
    money: MoneyData<string>,
    items: { item: string, amount: string }[],
    helditems: string[],
    multiplier: string,
    banks: string,
    bankLimit: string,
    level: number,
    xp: number,
    moveset: string[],
    [key: string]: any,
}
export interface GlobalData {
    itemStock: {
        [key: string]: number
    }
}
export var globalData: GlobalData = {
    itemStock: {

    }
}
if (existsSync("global.json")) {
    var g = JSON.parse(readFileSync("global.json", "utf8"), (k, v) => {
        if (typeof v == "string" && v.startsWith("BigInt:")) return BigInt(v.slice("BigInt:".length))
        return v
    })
    globalData = g || {}
}
export var users: Collection<string, UserInfo> = new Collection()
export function getUser(user: User | string): UserInfo {
    if (typeof user == "string") {
        user = client.users.cache.get(user) as User
    }
    if (!users.get(user.id)) createUser(user)
    //@ts-ignore
    return users.get(user.id)
}
export function level(user: User) {
    var u = getUser(user)
    return Math.floor(Math.cbrt(u.msgLvl_xp))
}
export function getLevelUpXP(user: User) {
    var u = getUser(user)
    var l = u.level + 1
    return (l * l * l) - ((l-1) * (l-1) * (l-1))
}
export function createUser(user: User) {
    var obj: UserInfo = {
        user,
        lobby: undefined,
        baseStats: {...baseStats},
        helditems: [],
        preset: "default",
        score: 1000,
        banks: 0n,
        lastWork: 0,
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
        rank_xp: 7 * 7,
        selection: new BitArray2D(map.width, map.height),
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
        moveset: ["bonk", "nerf_gun", "stronk", "spstronk"],
        msgLvl_messages: 0,
        msgLvl_xp: 0,
        
        ...(data[user.id] || {})
    }
    for (var k in obj.money) {
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
    var u = getUser(user)
    u.xp += amount
    var levels = 0;
    while (u.xp >= getLevelUpXP(user)) {
        u.xp -= getLevelUpXP(user)
        levels++
        u.level++
    }
    return levels;
}
export function getRank(user: User) {
    return Math.floor(Math.sqrt(getUser(user).rank_xp) / 7)
}