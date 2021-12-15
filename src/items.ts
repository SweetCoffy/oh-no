import { Collection, User } from "discord.js"
import { getUser, globalData } from "./users.js"
import { format } from "./util.js"

export interface ItemStack {
    item: string,
    amount: bigint,
}
type ItemUseCallback = (user: User, stack: ItemStack, amount: bigint) => ItemResponse | void
export interface ItemResponse {
    type: "sucess" | "info" | "fail",
    reason?: string
}
export function useItem(user: User, item: string, amount: bigint): ItemResponse {
    var u = getUser(user)
    var stack = getItem(user, item)
    if (stack) {
        if (stack.amount < amount) return {
            type: "fail",
            reason: "Tried to use more items than you have"
        }
        return shopItems.get(stack.item)?.use(user, stack, amount) || {
            type: "fail",
            reason: "What"
        }
    } else return {
        type: "fail",
        reason: "Tried to use an item you don't have"
    }
}
export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythical"
export class ItemType {
    name: string
    id: string
    icon: string = "🟥"
    cost: bigint = -1n
    rarity: Rarity = "Common"
    buyable: boolean = true
    stock: number = Infinity
    toString(amount: bigint = 1n) {
        var pre = ""
        if (amount != 1n) {
            pre = `${amount}x `
        }
        return pre + `${this.icon} ${this.name}`
    }
    onUse?: ItemUseCallback
    use(user: User, stack: ItemStack, amount: bigint): ItemResponse {
        if (this.onUse) return this.onUse(user, stack, amount) || { type: "sucess" }
        return {
            type: "fail",
            reason: "This item cannot be used"
        }
    }
    constructor(name: string, id: string, icon?: string, cost?: bigint) {
        this.name = name
        this.id = id
        if (icon) this.icon = icon
        if (cost) this.cost = cost
    }
    set(func: (el: ItemType) => any) {
        func(this)
        return this
    }
}
export function getItem(user: User, item: string) {
    var u = getUser(user)
    return u.items.find(el => el.item == item)
}
export function addItem(user: User, item: ItemStack): ItemStack {
    var u = getUser(user)
    var stack = u.items.find(el => el.item == item.item)
    if (stack) {
        stack.amount += item.amount
        return stack
    } else {
        stack = {
            item: item.item,
            amount: item.amount
        }
        u.items.push(stack)
        return stack
    }
}
export function removeItem(user: User, item: ItemStack): boolean {
    var u = getUser(user)
    var stack = u.items.find(el => el.item == item.item)
    if (stack) {
        stack.amount -= item.amount
        if (stack.amount < 0) return false
        else return true
    }
    return false
}
function addMultiplierItem(user: User, stack: ItemStack, amount: bigint, mul: bigint): ItemResponse {
    var add = amount * mul
    getUser(user).multiplier += add
    return {
        type: "sucess",
        reason: `+${format(add)} Multiplier`
    }
}
export var shopItems: Collection<string, ItemType> = new Collection()
shopItems.set("spaghet", new ItemType("Spaghet", "spaghet", "🍝", 1000n).set(el => {
    el.onUse = function(user, stack, amount) {
        stack.amount -= amount
        return addMultiplierItem(user, stack, amount, 1n)
    }
}))
shopItems.set("coin", new ItemType("Coin", "coin", "🪙", 10000n).set(el => {
    el.onUse = function(user, stack, amount) {
        stack.amount -= amount
        return addMultiplierItem(user, stack, amount + BigInt(Math.min(Math.round(Math.random() * Number(amount)), Number.MAX_SAFE_INTEGER)), 6n)
    }
}))
shopItems.set("bank", new ItemType("Bank", "bank", "🏦", 1000000n).set(el => {
    el.onUse = function(user, stack, amount) {
        var a = getUser(user).bankLimit - getUser(user).banks
        if (amount < a) a = amount
        if (a <= 0) return {
            type: "fail",
            reason: `The bank limit has been reached`
        }
        stack.amount -= a
        getUser(user).banks += a
        return {
            type: "sucess",
            reason: `+${a} Banks`
        }
    }
}))
shopItems.set("cheese", new ItemType("Cheese", "cheese", "🧀", 10n ** 11n).set(el => {
    el.stock = 1
}))

for (var [k, v] of shopItems) {
    if (globalData.itemStock[k] == undefined && v.stock != Infinity) globalData.itemStock[k] = v.stock
    v.stock = globalData.itemStock[k] ?? v.stock
}
//