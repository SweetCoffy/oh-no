import { User, Collection } from 'discord.js'
import { BattleLobby } from './lobby.js'
import { baseStats, Stats, getPreset, getPresetList, StatPreset } from './stats.js'
import { ItemStack, ItemType } from "./items.js"
import { writeFileSync, existsSync, readFileSync } from "fs"
if (!existsSync("users.json")) {
    writeFileSync("users.json", "{}")
}
export var data = JSON.parse(readFileSync("users.json", "utf8"))
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
    globalData = g
}
export var users: Collection<string, UserInfo> = new Collection()
export function getUser(user: User): UserInfo {
    if (!users.get(user.id)) createUser(user)
    //@ts-ignore
    return users.get(user.id)
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
        bankLimit: 100n,
        ...(data[user.id] || {})
    }
    for (var k in obj.money) {
        //@ts-ignore
        obj.money[k] = BigInt(obj.money[k])
    }
    obj.items = obj.items.map(el => {
        return {
            item: el.item,
            amount: BigInt(el.amount)
        }
    })
    obj.banks = BigInt(obj.banks)
    obj.bankLimit = BigInt(obj.bankLimit)
    obj.multiplier = BigInt(obj.multiplier)
    users.set(user.id, obj)
}