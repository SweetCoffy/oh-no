import { ItemShop, ItemStack, ItemType, Recipe, recipes, Shop, ShopItem, shopItems, shops } from "./items.js";
import { Move, moves } from "./moves.js"
import { Dictionary } from "./util.js";
import { readFileSync } from "fs";
import { resolve, join, dirname, basename } from "path";
import { locales } from "./locale.js";
import yaml from "js-yaml"
import { rogueItems, RogueItemType, RogueMoveLearnItem } from "./rogue_mode.js";
type TypeString = "string" | "number" | "bigint" | "itemstack" | "boolean" | "json" | "chance"
type ArrayTypeString = `array<${TypeString}>`
type Types = string | number | bigint | ItemStack | boolean | Dictionary<any>
interface ContentType {
    properties: Dictionary<TypeString | ArrayTypeString>,
    onLoad: (obj: Dictionary<Types | Types[]>) => any
}
export let loaded: Dictionary<Dictionary<Types | Types[]>> = {}
let types: Dictionary<ContentType> = {
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
    rogue_item: {
        properties: {
            "class": "string",
            id: "string",
            name: "string",
            icon: "string"
        },
        onLoad(obj) {
            const classes = {
                "RogueItemType": RogueItemType,
                RogueMoveLearnItem
            }
            //@ts-ignore
            let cls: typeof RogueItemType = classes[obj["class"]]
            let item = new cls(obj.name as string, obj.icon as string)
            for (let key in obj) {
                let k = key[0].toLowerCase() + key.slice(1)
                if (k in item) {
                    //@ts-ignore
                    item[k] = obj[k]
                }
            }
            //@ts-ignore
            rogueItems.set(obj.id, item)
        },
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
                let s = shops.get(obj.shop.toString())
                if (s) {
                    s.items.push({
                        id: obj.contentid.toString(),
                        cost: BigInt(obj.price.toString()) || 0n,
                    })
                }
            }
            let it = shopItems.get(obj.contentid.toString())
            if (it) {
                if ("smeltinto" in obj) it.smeltInto = obj.smeltinto as string
                if ("fuelneeded" in obj) it.fuelNeeded = BigInt(obj.fuelneeded as string)
                if ("unstackable" in obj) it.unstackable = obj.unstackable as boolean
                if ("defaultdata" in obj) it.defaultData = obj.defaultdata as Dictionary<any>;
            }
            if (typeof obj.onuse == "string") {
                let split = obj.onuse.toString().split(":")
                let path = "./" + split[0]
                import(path).then(a => {
                    let it = shopItems.get(obj.contentid.toString())
                    if (!it) return
                    if (split[1]) it.onUse = a[split[1]]
                    else it.onUse = a
                })
            }
            if (typeof obj.stackinfo == "string") {
                let split = obj.stackinfo.toString().split(":")
                let path = "./" + split[0]
                import(path).then(a => {
                    let it = shopItems.get(obj.contentid.toString())
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
            let r = new Recipe(obj.name.toString(), obj.output, ...obj.input)
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
            let o = locales[obj.localeid]
            for (let k in obj) {
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
            let m = moves.get(obj.contentid) || new Move("", "attack", 0)
            for (let k in m) {
                let lower = k.toLowerCase()
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
    
    let a: any = {}
    let obj: any = yaml.load(readFileSync(file, "utf8"))
    for (let k in obj) {
        a[k.toLowerCase()] = obj[k]
    }
    a._contentType = a.contenttype
    //console.log(a)
    if (!a) return;
    types[a._contentType.toString()].onLoad(a);
    loaded[file] = a;
}