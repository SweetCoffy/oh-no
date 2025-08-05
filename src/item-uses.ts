import { User } from "discord.js";
import { enemies, Enemy } from "./enemies.js";
import { addItem, addMultiplierItem, getItem, ItemResponse, ItemStack, ItemUseCallback, stackString } from "./items.js";
import { getRank, getUser } from "./users.js";
import { Dictionary, min, weightedRandom } from "./util.js";
import { Worker } from "worker_threads"
import { readFileSync, existsSync } from "fs"
import { load } from "js-yaml";

export let sandwich: ItemUseCallback = (user, stack, amount) => {
    return addMultiplierItem(user, stack, amount, 1n);
}
interface NameableItemData {
    name?: string
}
interface ToolItemData {
    durability: number,
    durability_max: number,
    type: "tool",
}
interface BatteryItemData {
    capacity: number,
    left: number,
}
type BoxItemData = NameableItemData & {
    items: ItemStack[],
    capacity: number,
    type: string
}
type PhoneItemData = BoxItemData & {
    powered: boolean,
}
function tryClone(obj: any) {
    if (typeof obj != "object") return obj
    return {...obj}
}
export let fishing_rod: ItemUseCallback = (user, stack, amount) => {
    let data = stack.data as ToolItemData;
    if (!data?.type.includes("tool")) return {
        type: "fail",
        reason: `This item has the wrong item data type. Expected "tool", got "${data?.type}"`
    }
    if (data.durability <= 0) {
        stack.amount = 0n
        return {
            type: "fail",
            reason: "The fishing rod broke!"
        }
    }
    data.durability -= Math.floor(Math.random() * 3) + 1
    if (Math.random() <= 0.25) return {
        type: "info",
        reason: "Nothing bit..."
    }
    let o = weightedRandom([
        [{item: "box"        , amount: 1n, data: 
        { type: "box", capacity: 4, name: "Egg Box", 
        items: [{item: "egg", amount: 12n}] 
        }} , 0.085],
        [{item: "fish"       , amount: 1n, data: undefined} , 0.5    ],
        [{item: "1g_gold"    , amount: 3n, data: undefined} , 0.25   ],
        [{item: "1kg_gold"   , amount: 1n, data: undefined} , 0.05  ],
        [{item: "box"        , amount: 1n, data: 
        { type: "box", capacity: 4, name: "Ocean Box", 
        items: [{item: "fish", amount: 5n}, {item: "1g_gold", amount: 5n}, {item: "bone", amount: 15n}] 
        }} , 0.115]
    ])
    let s = o as ItemStack;
    if (!o.data) {
        o.amount *= BigInt(Math.floor(1 + (getRank(user) * (1 + ((getRank(user)-1)*0.07)))))
    }
    addItem(user, s)
    return {
        type: "info",
        reason: `You got ${stackString(s)}!`
    }
}
export let box: ItemUseCallback = (user, stack, amount, command, item, amt) => {
    let data = stack.data as BoxItemData;
    if (!data?.type.includes("box")) return {
        type: "fail",
        reason: `This item has the wrong item data type. Expected "box", got "${data?.type}"`
    }
    if (command == "store") {
        let it = getItem(user, item)
        if (!it) return {
            type: "fail",
            reason: `You don't have the item \`${item}\``
        }
        if (it.item == stack.item) return {
            type: "fail",
            reason: "Cannot store a box inside another box"
        }
        if (data.items.length + 1 > data.capacity) return {
            type: "fail",
            reason: "This box is full"
        }
        let a = min(it.amount, BigInt(amt || it.amount))
        it.amount -= a;
        data.items.push({amount: a, item: it.item, data: tryClone(it.data)})
        return {
            type: "success",
            reason: `Stored ${stackString({item: it.item, amount: a})}`
        }
    } else if (command == "view") {
        return {
            type: "success",
            reason: data.items.map((el, i) => `\`#${i}\` ${stackString(el)}`).join("\n")
        }
    } else if (command == "rename") {
        if (!item) {
            if (delete data.name) {
                return {
                    type: "success",
                    reason: "Removed the name of the box"
                }
            } else {
                return {
                    type: "fail",
                    reason: "The box did not have a name"
                }
            }
        } else {
            item = item.trim()
            if (item.length < 1) return {
                type: "fail",
                reason: "The name must be at least 1 character"
            }
            if (item.length > 16) return {
                type: "fail",
                reason: "The name must not exceed 16 characters"
            }
            let oldname = data.name
            data.name = item;
            return {
                type: "success",
                reason: `Renamed ${oldname || "Box"} to ${item}`
            }
        }
    } else if (command == "take") {
        if (item == "all") {
            for (let s of data.items) {
                addItem(user, s)
            }
            data.items = []
            return {
                type: "success",
                reason: "Took out all the items from the box"
            }
        } else {
            let s = data.items.find(el => el.item == item)
            if (!s) return {
                type: "fail",
                reason: `The box doesn't have the item \`${item}\``
            }
            let a = min(s.amount, BigInt(amt))
            addItem(user, {...s, amount: a})
            s.amount -= a;
            data.items = data.items.filter(el => el.amount > 0n)
            return {
                type: "success",
                reason: `Took out ${a} items`
            }
        }
    }
    return {
        type: "fail",
        reason: "?"
    }
}
export let bone: ItemUseCallback = (user, stack, amount) => {
    if (stack.amount < 10n) return {
        type: "fail",
        reason: "It had no effect"
    }
    stack.amount -= 10n;
    getUser(user).forceEncounter = [enemies.get("the_skeleton") as Enemy]
    return {
        type: "success",
        reason: "Something will happen in the next encounter..."
    }
}