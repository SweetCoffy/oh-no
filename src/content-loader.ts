import { ItemStack, ItemType, Recipe, recipes, shopItems, shops } from "./items.js";
import { Move, moves } from "./moves.js"
import { Dictionary } from "./util.js";
import { readFileSync } from "fs";
import { resolve, join, dirname, basename } from "path";
import Hjson from "hjson"
import { locales, setupOwO } from "./locale.js";
import yaml from "js-yaml"
type TypeString = "string" | "number" | "bigint" | "itemstack" | "boolean" | "json" | "chance"
type ArrayTypeString = `array<${TypeString}>`
type Types = string | number | bigint | ItemStack | boolean | Dictionary<any>
var defaultProperties: Dictionary<TypeString> = {
    contentid: "string",
}
interface ContentType {
    properties: Dictionary<TypeString | ArrayTypeString>,
    onLoad: (obj: Dictionary<Types | Types[]>) => any
}
type Test = `${number}h`
export var loaded: Dictionary<Dictionary<Types | Types[]>> = {}
var types: Dictionary<ContentType> = {
    item: {
        properties: {
            name: "string",
            price: "bigint",
            icon: "string",
            shop: "string",
            onuse: "string",
            smeltinto: "string",
            fuelneeded: "bigint",
            unstackable: "boolean",
            defaultdata: "json",
            stackinfo: "string",
        },
        onLoad(obj) {
            shopItems.set(obj.contentid.toString(), new ItemType(obj.name.toString(), obj.contentid.toString(), obj.icon.toString(), BigInt(obj.price.toString()) || 0n))
            if (typeof obj.shop == "string") {
                var s = shops.get(obj.shop.toString())
                if (s) {
                    s.items.push({
                        id: obj.contentid.toString(),
                        cost: BigInt(obj.price.toString()) || 0n,
                    })
                }
            }
            var it = shopItems.get(obj.contentid.toString())
            if (it) {
                if ("smeltinto" in obj) it.smeltInto = obj.smeltinto as string
                if ("fuelneeded" in obj) it.fuelNeeded = BigInt(obj.fuelneeded as string)
                if ("unstackable" in obj) it.unstackable = obj.unstackable as boolean
                if ("defaultdata" in obj) it.defaultData = obj.defaultdata as Dictionary<any>;
            }
            if (typeof obj.onuse == "string") {
                var split = obj.onuse.toString().split(":")
                var path = "./" + split[0]
                import(path).then(a => {
                    var it = shopItems.get(obj.contentid.toString())
                    if (!it) return
                    if (split[1]) it.onUse = a[split[1]]
                    else it.onUse = a
                })
            }
            if (typeof obj.stackinfo == "string") {
                var split = obj.stackinfo.toString().split(":")
                var path = "./" + split[0]
                import(path).then(a => {
                    var it = shopItems.get(obj.contentid.toString())
                    if (!it) return
                    if (split[1]) it.stackInfo = a[split[1]]
                    else it.stackInfo = a
                })
            }
        }
    },
    recipe: {
        properties: {
            name: "string",
            input: "array<itemstack>",
            output: "itemstack",
        },
        onLoad(obj) {
            //@ts-ignore
            var r = new Recipe(obj.name.toString(), obj.output, ...obj.input)
            recipes.set(obj.contentid.toString(), r)
        }
    },
    locale: {
        properties: {
            "*": "string",
        },
        onLoad(obj) {
            //@ts-ignore
            if (!locales[obj.localeid]) locales[obj.localeid] = {}
            //@ts-ignore
            var o = locales[obj.localeid]
            for (var k in obj) {
                o[k] = obj[k]
            }
        }
    },
    move: {
        properties: {
            contentid: "string",
            name: "string",
            description: "string",
            requirescharge: "number",
            requiresmagic: "number",
            setdamage: "string",
            critmul: "number",
            category: "string",
            power: "number",
            accuracy: "number",
            type: "string",
            priority: "number",
            recoil: "number",
            userstatchance: "number",
            targetstatchance: "number",
            breakshield: "boolean",
            //inflictstatus: "array<chance>",
            selectable: "boolean",
            targetself: "boolean",
        },
        onLoad(obj) {
            if (typeof(obj.contentid) != "string") return;
            var m = moves.get(obj.contentid) || new Move("", "attack", 0)
            for (var k in m) {
                var lower = k.toLowerCase()
                //@ts-ignore
                if (lower in obj) m[k] = obj[lower];
            }
            moves.set(obj.contentid, m)
        }
    }
}
export function parseValueType(v: string, type: TypeString | ArrayTypeString): Types | Types[] {
    if (type == "string") {
        if (v.indexOf(`"`) == -1) return v.trim();
        return v.slice(v.indexOf(`"`) + 1, v.lastIndexOf(`"`))
    } else if (type == "number") {
        return Number(v.trim())
    } else if (type == "bigint") {
        return BigInt(v.trim())
    } else if (type == "itemstack") {
        let split = v.trim().split("*")
        var amt = BigInt(split[0])
        var id = split[1]
        return {
            item: id,
            amount: amt,
        }
    } else if (type.startsWith("array<")) {
        let h = v.slice(v.indexOf(`[`) + 1, v.lastIndexOf(`]`))
        let split = h.split(";")
        var t = type.slice("array<".length, -1) as TypeString
        //@ts-ignore
        return split.map(el => parseValueType(el, t))
    } else if (type == "boolean") {
        let g = v.trim().toLowerCase()
        if (g == "true" || g == "1" || g == "on" || g == "yes") return true
        if (g == "false" || g == "0" || g == "off" || g == "no") return false
        throw new Error(`Invalid boolean: ${g}`)
    } else if (type == "json") {
        var g = Hjson.parse(v)
        return g
    } else if (type == "chance") {
        var h = v.trim().split("%")
        var chance = Number(h[0]) / 100
        var thing = h[1]
        return {
            id: thing,
            chance: chance,
        }
    }
    return 0
}
export function parse(str: string, basepath: string = ".") {
    var h = str.split("\n")
    var type = h.shift() + ""
    if (type == "include_only") return undefined;
    var props = {...defaultProperties, ...types[type].properties}
    var o: Dictionary<Types | Types[]> = {}
    for (var i = 0; i < h.length; i++) {
        var s = h[i]
        if (s.startsWith("#")) {
            var r = s.slice(1)
            if (r[0] == " ") r = r.slice(1)
            var arg = r.split(" ")
            if (arg[0] == "include") {
                var path = arg.slice(1).join(" ")
                h.push(...readFileSync(join(basepath, path), "utf8").split("\n"))
            }
            continue;
        }
        var g = s.split("=")
        var kstr = g[0].trim().toLowerCase().replace(/[ \t\n]/g, "")
        var v = g.slice(1).toString()
        var keys = kstr.split(",")
        for (var k of keys) {
            if (k in props || "*" in props) {
                var spl = k.split(":")
                var realk = spl[0].trim()
                var forceType = spl[1]?.trim() as TypeString | ArrayTypeString
                o[realk] = parseValueType(v, forceType || props[k] || props["*"])
            }
        }
    }
    o._contentType = type;
    return o
}
export function load(file: string) {
    console.log(`Loading file: ${file}`)
    file = resolve(join("./", file))
    
    if (file.endsWith(".owo") || file.endsWith(".balls")) var a: any = parse(readFileSync(file, "utf8"), dirname(file))
    if (file.endsWith(".yml")) {
        var obj: any = yaml.load(readFileSync(file, "utf8"))
        var a: any = {}
        for (var k in obj) {
            a[k.toLowerCase()] = obj[k]
        }
        a._contentType = a.contenttype
        console.log(a)
    }
    if (!a) return;
    types[a._contentType.toString()].onLoad(a);
    loaded[file] = a;
}