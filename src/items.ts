import { AutocompleteInteraction, Collection, User } from "discord.js"
import { enemies } from "./enemies.js"
import { getUser } from "./users.js"
import { Dictionary, min } from "./util.js"
import { format } from "./number-format.js"

export interface ItemStack {
    item: string,
    amount: bigint,
    data?: any,
}
export type StackInfoCallback = (stack: ItemStack) => string
export type ItemUseCallback = (user: User, stack: ItemStack, amount: bigint, ...args: string[]) => ItemResponse | AsyncGenerator<ItemResponse> | void
export interface ItemResponse {
    type: "success" | "info" | "fail",
    reason?: string,
    edit?: boolean
}
export async function* useItem(user: User, item: string, amount: bigint, ...args: string[]): AsyncGenerator<ItemResponse> {
    let u = getUser(user)
    let stack = getItem(user, item)
    if (stack) {
        if (stack.amount < amount) return {
            type: "fail",
            reason: "Tried to use more items than you have"
        }
        let a = shopItems.get(stack.item)?.use(user, stack, amount, ...args)
        // @ts-ignore
        if (a?.[Symbol.toStringTag] == "AsyncGenerator") {
            let gen = a as AsyncGenerator<ItemResponse>
            for await (let res of gen) {
                yield res;
            }
            // @ts-ignore
        } else if (a?.[Symbol.toStringTag] == "Generator") {
            let gen = a as unknown as Generator<ItemResponse>
            for (let res of gen) {
                yield res;
            }
        } else {
            yield (a as ItemResponse) || {
                type: "fail",
                reason: "What"
            }
            return
        }
    } else {
        yield {
            type: "fail",
            reason: "Tried to use an item you don't have"
        }
        return
    }
}
export function stackString(stack: ItemStack, icon: boolean = true) {
    let type = shopItems.get(stack.item)
    return `${stack.amount != 1n ? `x${format(stack.amount)} ` : ""}` + 
    `${icon ? (shopItems.get(stack.item)?.icon || "🅱️") + " " : ""}` + 
    `${stack.data?.name || shopItems.get(stack.item)?.name}` + 
    `${stack.data?.name ? "*" : ""}` + 
    `${stack.data?.type?.startsWith("tool") ? ` (${Math.floor(stack.data.durability)} / ${Math.floor(stack.data.durability_max)} Durability)` : ``}` +
    `${type?.stackInfo ? `${type.stackInfo(stack)} ` : ``}`
}
export function itemString(id: string) {
    return stackString({ item: id, amount: 1n })
}
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary"
export class ItemType {
    name: string
    id: string
    icon: string = "🟥"
    cost: bigint = -1n
    rarity: Rarity = "common"
    buyable: boolean = true
    stock: number = Infinity
    fuelPower: bigint = 0n
    smeltInto?: string
    fuelNeeded: bigint = 5n
    unstackable: boolean = false
    defaultData?: Dictionary<any>
    autocomplete?: (user: User, stack: ItemStack, i: AutocompleteInteraction) => any
    toString(amount: bigint = 1n) {
        let pre = ""
        if (amount != 1n) {
            pre = `${format(amount)}x `
        }
        return pre + `${this.icon} ${this.name}`
    }
    stackInfo?: StackInfoCallback
    onUse?: ItemUseCallback
    use(user: User, stack: ItemStack, amount: bigint, ...args: string[]): ItemResponse | AsyncGenerator<ItemResponse> {
        if (this.onUse) {
            let r = this.onUse(user, stack, amount, ...args)
            //@ts-ignore
            return r;
        }
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
    let u = getUser(user)
    u.items = u.items.filter(el => el.amount > 0n)
    if (!Number.isNaN(+item)) return u.items[+item];
    return u.items.find(el => el.item == item)
}
export function addItem(user: User, item: ItemStack): ItemStack {
    let u = getUser(user)
    let stack = u.items.find(el => el.item == item.item)
    if (stack && !stack.data && !item.data && !shopItems.get(item.item)?.unstackable) {
        stack.amount += item.amount
        return stack
    } else {
        stack = {
            item: item.item,
            amount: item.amount,
        }
        if (item.data) stack.data = {...item.data}
        u.items.push(stack)
        return stack
    }
}
export function removeItem(user: User, item: ItemStack): boolean {
    let u = getUser(user)
    let stack = u.items.find(el => el.item == item.item)
    if (stack) {
        stack.amount -= item.amount
        if (stack.amount < 0) return false
        else return true
    }
    return false
}
export function addMultiplierItem(user: User, stack: ItemStack, amount: bigint, mul: bigint): ItemResponse {
    let add = amount * mul
    getUser(user).multiplier += add
    return {
        type: "success",
        reason: `+${format(add)} Multiplier`
    }
}
export let shopItems: Collection<string, ItemType> = new Collection()
shopItems.set("spaghet", new ItemType("Spaghet", "spaghet", "🍝", 1000000n).set(el => {
    el.onUse = function(user, stack, amount) {
        stack.amount -= amount
        return addMultiplierItem(user, stack, amount, 1n)
    }
}))
shopItems.set("coin", new ItemType("Coin", "coin", "🪙", 10000000n).set(el => {
    el.onUse = function(user, stack, amount) {
        stack.amount -= amount
        return addMultiplierItem(user, stack, amount + BigInt(Math.min(Math.round(Math.random() * Number(amount)), Number.MAX_SAFE_INTEGER)), 6n)
    }
}))
shopItems.set("bank", new ItemType("Bank", "bank", "🏦", 1000000000n).set(el => {
    el.onUse = function(user, stack, amount) {
        let a = getUser(user).bankLimit - getUser(user).banks
        if (amount < a) a = amount
        if (a <= 0) return {
            type: "fail",
            reason: `The bank limit has been reached`
        }
        stack.amount -= a
        getUser(user).banks += a
        return {
            type: "success",
            reason: `+${a} Banks`
        }
    }
}))
shopItems.set("cheese", new ItemType("Cheese", "cheese", "🧀", 10n ** 11n).set(el => {
    
}))
shopItems.set("cookie", new ItemType("Cookie", "cookie", "🍪", 5000n).set(el => {
    el.onUse = function(user, stack, amount) {
        if (amount < 100n) return {
            type: "info",
            reason: "It had no effect"
        }
        let e = enemies.get("u")
        if (Math.random() > 0.5) e = enemies.get("o")
        //@ts-ignore
        getUser(user).forceEncounter = [e]
        stack.amount -= 100n
        return {
            type: "success",
            reason: `You have summoned The God ${e?.name}`
        }
    }
}))
shopItems.set("bank_license", new ItemType("Bank License", "bank_license", "📄", 5000n).set(el => {
    el.onUse = function(user, stack, amount) {
        stack.amount -= amount
        getUser(user).bankLimit += amount
        return {
            type: "success",
            reason: `+${format(amount)} Bank limit`
        }
    }
}))
shopItems.set("soul", new ItemType("Soul", "soul", "🧹", 5n).set(el => {

}))
export function summonBoss(user: User, stack: ItemStack, amount: bigint, boss: string): ItemResponse {
    let b = enemies.get(boss)
    if (getUser(user).forceEncounter) return {
        type: "fail",
        reason: `${b?.name} cannot be summoned right now`
    }
    stack.amount--
    //@ts-ignore
    getUser(user).forceEncounter = [b]
    return {
        type: "success",
        reason: `The next encounter will now be ${b?.name}`
    }
}
shopItems.set("copper", new ItemType("Copper", "copper", "<:copper:770035910334349334>", 10n))
shopItems.set("stone", new ItemType("Stone", "stone", "🪨", 1n))
shopItems.set("egg", new ItemType("Egg", "egg", "🥚", 5n).set(el => {
    el.smeltInto = "cooked_egg"
}))
shopItems.set("cooked_egg", new ItemType("Cooked Egg", "cooked_egg", "🍳", 10n).set(el => {
    el.onUse = function(user, stack, amount) {
        return summonBoss(user, stack, amount, "egg_lord")
    }
}))
shopItems.set("wood", new ItemType("Wood", "wood", "🪵", 10n).set(el => {
    el.fuelPower = 5n;
}))
shopItems.set("sus_bell", new ItemType("Suspicious Looking Bell", "sus_bell", "🔔", 25n).set(el => {
    el.onUse = function(user, stack, amount) {
        return summonBoss(user, stack, amount, "the_cat")
    }
}))
//if (!globalData.itemStock) globalData.itemStock = {}
//for (let [k, v] of shopItems) {
//    if (globalData.itemStock[k] == undefined && v.stock != Infinity) globalData.itemStock[k] = v.stock
//    v.stock = globalData.itemStock[k] ?? v.stock
//}

export interface ShopItem {
    id: string,
    cost: bigint,
}
type ShopResponse = ItemResponse
export class Shop {
    items: ShopItem[]
    name: string
    moneyIcon: string = "$"
    getMoney(user: User) {
        return getUser(user).money.points
    }
    setMoney(user: User, amount: bigint) {
        getUser(user).money.points = amount
    }
    addMoney(user: User, amount: bigint) {
        this.setMoney(user, this.getMoney(user) + amount)
    }
    getItem(item: string) {
        return this.items.find(el => el.id == item)
    }
    buyItem(user: User, item: string, amount: bigint): ShopResponse {
        let money = this.getMoney(user)
        let it = this.getItem(item)
        if (!it) return {
            type: "fail",
            reason: `Unknown item`
        }
        let type = shopItems.get(it.id)
        if (type && type.unstackable) amount = 1n;
        let cost = amount * it.cost
        if (money < cost) return {
            type: "fail",
            reason: `Can't afford item (${this.moneyIcon} ${format(cost)})`
        }
        let d = shopItems.get(it.id)?.defaultData
        if (d) d = {...d}
        addItem(user, {
            item: it.id,
            amount: amount,
            data: d
        })
        this.addMoney(user, -cost)
        return {
            type: "success",
            reason: `Bought ${shopItems.get(it.id)?.toString(amount)} for ${this.moneyIcon} ${format(cost)}`
        }
    }
    constructor(name: string, items: ShopItem[]) {
        this.name = name
        this.items = items
    }
}
export class ItemShop extends Shop {
    itemCurrency: string
    getMoney(user: User) {
        return getItem(user, this.itemCurrency)?.amount || 0n
    }
    setMoney(user: User, amount: bigint) {
        let stack = getItem(user, this.itemCurrency)
        if (!stack) addItem(user, {
            item: this.itemCurrency,
            amount: amount
        })
        else stack.amount = amount
    }
    constructor(name: string, items: ShopItem[], item: string) {
        super(name, items)
        this.itemCurrency = item
        this.moneyIcon = shopItems.get(item)?.icon || "$"
    }
}
export class Recipe {
    name: string
    output: ItemStack
    input: ItemStack[]
    constructor(name: string, output: ItemStack, ...input: ItemStack[]) {
        this.name = name;
        this.output = output;
        this.input = input;
    }
    canCraft(user: User): bigint {
        let inv = getUser(user).items;
        let h = min(...this.input.map(el => (getItem(user, el.item)?.amount||0n) / el.amount))
        return h;
    }
}
let mainShop = new Shop("Main Shop", [{ id: "cookie", cost: 10000n }, { id: "spaghet", cost: 100000n }, { id: "egg", cost: 100n }, { id: "wood", cost: 200n }])
//let cookieShop = new ItemShop("Cookie Shop", [{id: "coin", cost: 150n}, { id: "bank", cost: 175000n }, { id: "soul", cost: 10000000n }], "cookie")
//let soulShop = new ItemShop("Soul Shop", [{id: "bank_license", cost: 1n}], "soul")
export let shops: Collection<string, Shop> = new Collection()
shops.set("main", mainShop)
//shops.set("cookie", cookieShop)
//shops.set("soul", soulShop)
export let recipes: Collection<string, Recipe> = new Collection()
//recipes.set("bank_license", new Recipe("Bank License (Cookies)", { item: "bank_license", amount: 1n }, 
//    { item: "cookie", amount: 2n },
//))