import { AutocompleteInteraction, User } from "discord.js";
import { enemies, Enemy } from "./enemies.js";
import { addItem, addMultiplierItem, getItem, ItemResponse, ItemStack, ItemUseCallback, shopItems, stackString, summonBoss } from "./items.js";
import { getRank, getUser } from "./users.js";
import { Dictionary, lexer, max, min, weightedRandom } from "./util.js";
import { Worker } from "worker_threads"
import { readFileSync, existsSync } from "fs"
import { load } from "js-yaml";

export var sandwich: ItemUseCallback = (user, stack, amount) => {
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
export var fishing_rod: ItemUseCallback = (user, stack, amount) => {
    var data = stack.data as ToolItemData;
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
    var o = weightedRandom([
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
    var s = o as ItemStack;
    if (!o.data) {
        o.amount *= BigInt(Math.floor(1 + (getRank(user) * (1 + ((getRank(user)-1)*0.07)))))
    }
    addItem(user, s)
    return {
        type: "info",
        reason: `You got ${stackString(s)}!`
    }
}
export var box: ItemUseCallback = (user, stack, amount, command, item, amt) => {
    var data = stack.data as BoxItemData;
    if (!data?.type.includes("box")) return {
        type: "fail",
        reason: `This item has the wrong item data type. Expected "box", got "${data?.type}"`
    }
    if (command == "store") {
        var it = getItem(user, item)
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
        var a = min(it.amount, BigInt(amt || it.amount))
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
            var oldname = data.name
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
            var a = min(s.amount, BigInt(amt))
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
export var bone: ItemUseCallback = (user, stack, amount) => {
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
function normPath(path: string | undefined) {
    return (path || "/").split("/").filter(el => el).join("/") || "/"
}
function getPath(obj: any, path: string | undefined): any {
    return (path || "/").split("/").filter(el => el).reduce((prev, cur, i) => prev?.[cur], obj)
}
function setPath(obj: any, path: string | undefined, value: any): any {
    (path || "/").split("/").filter(el => el).reduce((prev, cur, i, ar) => {
        if (i < ar.length - 1) {
            if (!prev[cur]) prev[cur] = {}
            return prev[cur]
        }
        else prev[cur] = value
    }, obj)
}
function deletePath(obj: any, path: string | undefined): any {
    (path || "/").split("/").filter(el => el).reduce((prev, cur, i, ar) => {
        if (i < ar.length - 1) {
            if (!prev[cur]) return {}
            return prev[cur]
        } else delete prev[cur]
    }, obj)
}
interface Pkg {
    files: Dictionary<string>,
    depends: string[]
}
export async function* phone(user: User, stack: ItemStack, amount: bigint, ...args: string[]): AsyncGenerator<ItemResponse> {
    var data = stack.data as PhoneItemData
    if (data?.type != "box-phone") return {
        type: "fail",
        reason: `This item has the wrong item data type. Expected "box-phone", got "${data?.type}"`
    }
    var cmd = args.shift()
    if (cmd == "inv") {
        yield box(user, stack, amount, ...args) as ItemResponse
        return
    }
    var battery = data.items[0]
    if (battery?.item != "battery") {
        yield {
            type: "fail",
            reason: "battery when"
        }
        return
    }
    var batteryData = battery.data as BatteryItemData
    if (cmd == "power") {
        if (data.powered) {
            data.powered = false;
            yield { type: "success", reason: "Shutting down..." }
            return yield { type: "success", reason: "Death" }
        } else {
            if (!batteryData || batteryData.left <= 0) return yield { type: "fail", reason: `The battery is dead` }
            data.powered = true;
            return yield { type: "success", reason: "Booted up" }
        }
    } else if (!data.powered) return yield { type: "fail", reason: "why tf are you trying to use a phone while it's off" }
    yield { type: "info", reason: "...", edit: true }
    type PhoneFS = NodeJS.Dict<Buffer & PhoneFS>
    var _fs: PhoneFS = {main: data.items[1].data?.fs}
    if (!_fs.main) return yield { type: "fail", reason: `storage when` }
    function getFSItem(item: any) {
        var data = item.data
        if (!data) return undefined;
        if (data.type == "storage") return data.fs;
        else if (item.item == "battery") return {
            capacity: data.capacity,
            left: data.left,
        }
        return undefined
    }
    var fs: PhoneFS = new Proxy(_fs, {
        get(t, p, r) {
            if (typeof p == "symbol") return Reflect.get(t, p, r)
            if (p.startsWith("dev")) {
                var num = parseInt(p[3], 16)
                var it = data.items[num]
                return getFSItem(it)
            }
            return Reflect.get(t, p, r)
        },
        getOwnPropertyDescriptor(t, p) {
            if (typeof p == "symbol") return Reflect.getOwnPropertyDescriptor(t, p)
            if (p.startsWith("dev")) {
                var num = parseInt(p[3], 16)
                var it = data.items[num]
                if (data.items[num]) return { enumerable: true, value: getFSItem(it), configurable: true, writable: false }
            }
            return Reflect.getOwnPropertyDescriptor(t, p)
        },
        deleteProperty(t, p) {
            return Reflect.deleteProperty(t, p)
        },
        ownKeys(t) {
            var ar = [...data.items.map((el, i) => `dev${i}_${el.item}`), ...Reflect.ownKeys(t)]
            console.log(data.items)
            console.log(ar)
            return ar
        },
        
    })
    if (cmd == "eggman") {
        if(args.length < 2) return yield { type: "fail", reason: "Not enough arguments", edit: true }
        var sub = args.shift() as string
        var arg = args.shift() as string
        var installpath = "main"
        function query(name: string): Pkg | undefined {
            var path = `eggos_pkg/${name}`
            console.log(`Querying '${name}' (${path})`)
            if (!existsSync(`${path}/pkg.yml`)) return
            return load(readFileSync(`${path}/pkg.yml`, "utf8")) as Pkg
        }
        function add(name: string): Pkg | undefined {
            var path = `eggos_pkg/${name}`
            var p = query(name)
            console.log(`Adding '${name}'`)
            if (!p) return
            for (var k in p.files) {
                setPath(fs, `${installpath}/${p.files[k]}`, readFileSync(`${path}/${k}`, "utf8"))
            }
            return p
        }
        function rm(name: string): Pkg | undefined {
            var path = `eggos_pkg/${name}`
            var p = query(name)
            if (!p) return
            for (var k in p.files) {
                deletePath(fs, `${installpath}/${p.files[k]}`)
            }
            return p
        }
        if (sub == "rm") {
            if (rm(arg)) {
                return yield { type: "success", reason: `Removed '${arg}'`, edit: true }
            } else return yield { type: "fail", reason: `br`, edit: true }
        } else if (sub == "add") {
            var pk = add(arg)
            if (pk) {
                return yield { type: "success", reason: `Added '${arg}'`, edit: true }
            } else return yield { type: "fail", reason: `br`, edit: true }
        } else return yield { type: "fail", reason: "burh", edit: true }
    }
    
    //return yield { type: "info", reason: "lol no", edit: true }
    var acc = ""
    var worker = new Worker("./build/phone-worker.js", {workerData: { args: [cmd, ...args] }, resourceLimits: { maxYoungGenerationSizeMb: 8, codeRangeSizeMb: 8, maxOldGenerationSizeMb: 16 }})
    worker.on("message", (msg: { id: number } & 
        ({ type: "read", path: string } 
        | { type: "write", path: string, cont: Uint8Array } 
        | { type: "msg", message: string, edit: boolean } 
        | { type: "readdir", cont: string[], path: string })) => {
        if (msg.type == "read") {
            console.log(`Read to ${msg.path} received`)
            var c = getPath(fs, msg.path)
            worker.postMessage({ id: msg.id, content: (c == undefined) ? undefined : Buffer.from(c + "") })
            console.log(`Read to ${msg.path} sent (id: ${msg.id})`)
        } else if (msg.type == "write") {
            setPath(fs, msg.path, msg.cont)
            worker.postMessage({ id: msg.id })
        } else if (msg.type == "msg") {
            acc += msg.message + "\n"
        } else if (msg.type == "readdir") {
            var c = getPath(fs, msg.path)
            
            worker.postMessage({ id: msg.id, content: (typeof c == "object") ? Object.keys(c) : undefined })
        }
    })
    worker.on("error", (er) => {
        console.log(er)
    })
    worker.stdout.on("data", (chunk) => {
        acc += chunk
        console.log(chunk + "")
    })
    var timeout = setTimeout(() => {
        worker.terminate()
    }, 5000)
    function waitForExit(): Promise<number> {
        return new Promise((resolve) => {
            worker.once("exit", (code) => {
                resolve(code)
            })
        })
    }
    var code = await waitForExit()
    clearTimeout(timeout)
    var type: "info" | "fail" = (code == 0) ? "info" : "fail"
    
    if (!acc) yield { type: type, reason: "br", edit: true }
    else yield { type: type, reason: acc, edit: true }
}