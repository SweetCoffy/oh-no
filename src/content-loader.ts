import { ItemShop, ItemStack, ItemType, Recipe, recipes, Shop, ShopItem, shopItems, shops } from "./items.js";
import { Move, moves } from "./moves.js"
import { Dictionary } from "./util.js";
import { readFileSync } from "fs";
import { resolve, join, dirname, basename } from "path";
import { locales, setupOwO } from "./locale.js";
import yaml from "js-yaml"
type TypeString = "string" | "number" | "bigint" | "itemstack" | "boolean" | "json" | "chance"
type ArrayTypeString = `array<${TypeString}>`
type Types = string | number | bigint | ItemStack | boolean | Dictionary<any>
interface ContentType {
    properties: Dictionary<TypeString | ArrayTypeString>,
    onLoad: (obj: Dictionary<Types | Types[]>) => any
}
export var loaded: Dictionary<Dictionary<Types | Types[]>> = {}
var types: Dictionary<ContentType> = {
    shop: {
        properties: {
            name: "string",
            type: "string",
            currencyitem: "string",
        },
        onLoad(obj) {
            let type = Shop
            //@ts-ignore
            if (obj.type == "ItemShop") type = ItemShop
            //@ts-ignore
            let shop = new type(obj.name as string, obj.items as ShopItem[] || [], obj.currencyitem as string)
            let existingShop = shops.get(obj.contentid as string)
            if (existingShop) {
                shop.items.unshift(...existingShop.items)
            }
            shops.set(obj.contentid as string, shop)
        }
    },
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
export function load(file: string) {
    console.log(`Loading file: ${file}`)
    file = resolve(join("./", file))
    
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