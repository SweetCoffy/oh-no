import { Collection, User } from "discord.js"
import { Grid } from "./grid.js"
import { client } from "./index.js"
import { addItem, ItemStack, shopItems } from "./items.js"
import { getUser } from "./users.js"
import { BitArray2D } from "./util.js"
import Simplex from "simplex-noise"

var stoneNoise = new Simplex()
var stoneNoise2 = new Simplex()
var waterNoise = new Simplex()
var oreNoise = new Simplex()

export var tileToChar: { [key: string]: string } = {
    "grass": "0",
    "stone": "1",
    "copper-ore": "2",
    "water": "3",
}
export var charToTile: { [key: string]: string } = {
    "0": "grass",
    "1": "stone",
    "2": "copper-ore",
    "3": "water",
}


export class TileType {
    ore?: string
    hardness: number = 0
    liquid?: string
    solid: boolean = false
    density: number = 1
    set(func: (el: TileType) => any) {
        func(this)
        return this
    }
    constructor() {

    }
}
export class BuildingType {
    buildCost: ItemStack[]
    outputsItems: boolean = false
    acceptsItems: boolean = false
    outputsLiquids: boolean = false
    acceptsLiquids: boolean = false
    baseSprite: string
    floating: boolean = false
    canHoldItem: string[] = []
    canHoldLiquid: string[] = []
    getSprite(build: Building) {
        return this.baseSprite
    }
    canBuild(x: number, y: number) {
        var t = map.get(x, y)
        var type = t?.info
        if (!type) return false
        if (!this.floating && type.liquid) return false
        if (type.solid) return false
        if (this.floating && type.liquid) {
            var checkSides = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}]
            var tiles = checkSides.map(el => map.get(x + el.x, y + el.y))
            for (var t of tiles) {
                if (!t?.info?.liquid && !t?.info?.solid) return true
            }
            return false
        }
        return true
    }
    canOutputItem(build: Building, item: string) {
        return true
    }
    update(build: Building, x: number, y: number) {
        if (this.outputsItems) {
            var checkSides = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}]
            var tiles = checkSides.map(el => build.tile.map.get(x + el.x, y + el.y))
            .filter(el => el != undefined).map(el => el?.building).filter(el => el != undefined).filter(el => el?.info?.acceptsItems)
            var t = tiles[Math.floor(Math.random() * tiles.length)]
            if (t) {
                for (var it of build.storage.items) {
                    t.storage.addItem(it)
                }
                build.storage.items = []
            }
        }
    }
    set(func: (el: BuildingType) => any) {
        func(this)
        return this
    }
    constructor(baseSprite: string, buildCost: ItemStack[]) {
        this.buildCost = buildCost
        this.baseSprite = baseSprite
    }
}
export class DrillBuildingType extends BuildingType {
    drillPower: number = 1
    drillSpeed: number = 1
    outputsItems: boolean = true
    acceptsLiquids: boolean = true
    canHoldItem: string[] = ["any"]
    canBuild(x: number, y: number) {
        return BuildingType.prototype.canBuild.call(this, x, y) && !!map.get(x, y)?.info?.ore
    }
    update(build: Building, x: number, y: number): void {
        BuildingType.prototype.update.call(this, build, x, y)
        var type = tileTypes.get(build.tile.type)
        if (type?.ore) {
            var factor = ((this.drillPower - type.hardness) + 0.5) / 2
            if (factor <= 0) return
            var n = (factor * this.drillSpeed)
            var stack = build.storage.getLiquid("water")
            if (stack && stack.amount >= 1.5) {
                stack.amount -= 1.5
                n *= 1.5
            }
            var int = Math.floor(n)
            var dec = n % 1
            var amt = BigInt(int)
            if (Math.random() < dec) amt++

            build.storage.addItem({
                item: type.ore,
                amount: amt,
            })
        }
    }
}
export class PumpBuildingType extends BuildingType {
    pumpSpeed: number = 0.5
    outputsItems: boolean = false
    acceptsLiquids: boolean = false
    canHoldItem: string[] = []
    canHoldLiquid: string[] = ["any"]
    outputsLiquids: boolean = true
    update(build: Building, x: number, y: number): void {
        BuildingType.prototype.update.call(this, build, x, y)
        var type = tileTypes.get(build.tile.type)
        if (type?.liquid) {
            var amt = this.pumpSpeed / type.density

        }
    }
}
export class ConveyorBuildingType extends BuildingType {
    acceptsItems: boolean = true
    acceptsLiquids: boolean = true
    canHoldItem: string[] = ["any"]
    update(build: Building, x: number, y: number) {
        BuildingType.prototype.update.call(this, build, x, y)
        var back = build.tile.map.get(x - build.facingx, y - build.facingy)
        var fwd = build.tile.map.get(x + build.facingx, y + build.facingy)
        if (back?.building) {
            if (back.building.info?.outputsItems) {
                var removeItems: string[] = []
                for (let it of back.building.storage.items) {
                    if (back.building.canOutputItem(it.item)) {
                        build.storage.addItem(it)
                        removeItems.push(it.item)
                    }
                }
                back.building.storage.items = back.building.storage.items.filter(el => !removeItems.includes(el.item))
            }
            if (back.building.info?.outputsLiquids) {
                for (let it of back.building.storage.liquid) {
                    //if (back.building.canOutputItem(it.item)) {
                        if (build.storage.addLiquid(it)) {
                            it.amount = 0
                        }
                    //}
                }
            }
        }
        if (fwd?.building) {
            if (fwd.building.info?.acceptsItems) {
                for (let it of build.storage.items) {
                    if (fwd.building.storage.addItem(it)) {
                        it.amount = 0n
                    }
                }
            }
            if (fwd.building.info?.acceptsLiquids) {
                for (let it of build.storage.liquid) {
                    if (fwd.building.storage.addLiquid(it)) {
                        it.amount = 0
                    }
                }  
            }
        }
    }
    getSprite(build: Building) {
        return this.baseSprite + `-f${build.facingx},${build.facingy}`
    }
}
export class LauncherBuildingType extends BuildingType {
    acceptsItems: boolean = true
    canHoldItem: string[] = ["any"]
    update(build: Building, x: number, y: number) {
        BuildingType.prototype.update.call(this, build, x, y)
        var user = client.users.cache.get(build.tile.owner || "")
        if (!user) return
        for (var it of build.storage.items) {
            addItem(user, it)
        }
        build.storage.items = []
    }
}
export class SellerBuildingType extends BuildingType {
    acceptsItems: boolean = true
    canHoldItem: string[] = ["any"]
    update(build: Building, x: number, y: number) {
        BuildingType.prototype.update.call(this, build, x, y)
        var user = client.users.cache.get(build.tile.owner || "")
        if (!user) return
        for (var it of build.storage.items) {
            getUser(user).money.points += (shopItems.get(it.item)?.cost || 0n) * it.amount
        }
        build.storage.items = []
    }
}


export type Color = [number, number, number, number]
export class LiquidType {
    name: string
    color: Color
    constructor(name: string, color: Color) {
        this.name = name
        this.color = color
    }
}

export var tileTypes: Collection<string, TileType> = new Collection()
export var buildingTypes: Collection<string, BuildingType> = new Collection()
export var liquidTypes: Collection<string, LiquidType> = new Collection()


tileTypes.set("grass", new TileType())

tileTypes.set("stone", new TileType().set(el => {
    el.ore = "stone"
    el.hardness = 0.75
}))

tileTypes.set("copper-ore", new TileType().set(el => {
    el.ore = "copper"
    el.hardness = 1
}))

tileTypes.set("water", new TileType().set(el => {
    el.liquid = "water"
}))


buildingTypes.set("basic-drill", new DrillBuildingType("basic-drill", [
    {
        item: "cookie",
        amount: 25n,
    }
]))
buildingTypes.set("basic-pump", new PumpBuildingType("basic-pump", [
    {
        item: "copper",
        amount: 20n,
    },
    {
        item: "stone",
        amount: 5n,
    }
]).set(el => {
    el.floating = true
}))
buildingTypes.set("conveyor", new ConveyorBuildingType("conveyor", [
    {
        item: "cookie",
        amount: 5n
    }
]).set(el => {
    el.floating = true
}))
buildingTypes.set("launcher", new LauncherBuildingType("launcher", [
    {
        item: "cookie",
        amount: 30n,
    }
]))
buildingTypes.set("seller", new SellerBuildingType("seller", [
    {
        item: "cookie",
        amount: 100n,
    }
]))
export interface LiquidStack {
    type: string,
    amount: number,
}
export class BuildingStorage {
    readonly building: Building
    items: ItemStack[] = []
    liquid: LiquidStack[] = []
    liquidCapacity: number = 100
    get canHoldLiquid() {
        return this.building.info?.canHoldLiquid || []
    }
    get canHoldItem() {
        return this.building.info?.canHoldItem || []
    }
    toJSON() {
        return {items: this.items.map(el => ({i: el.item, a: el.amount + ""})), liquid: this.liquid.map(el => ({t: el.type, a: el.amount}))}
    }
    addLiquid(liquid: LiquidStack) {
        if (!this.canHoldLiquid.includes(liquid.type) && !this.canHoldLiquid.includes("any")) return false
        var stack = this.liquid.find(el => el.type == liquid.type)
        if (!stack) {
            stack = {
                type: liquid.type,
                amount: 0,
            }
            this.liquid.push(stack)
        }
        if (stack.amount + liquid.amount > this.liquidCapacity) return false
        stack.amount += liquid.amount
        return true
    }
    getLiquid(liquid: string) {
        return this.liquid.find(el => el.type == liquid)
    }
    getItem(item: string) {
        return this.items.find(el => el.item == item)
    }
    addItem(item: ItemStack) {
        if (!this.canHoldItem.includes(item.item) && !this.canHoldItem.includes("any")) {
            return false
        }
        var stack = this.items.find(el => el.item == item.item)
        if (stack) {
            stack.amount += item.amount
            return true
        } else {
            stack = {
                item: item.item,
                amount: item.amount
            }
            this.items.push(stack)
            return true
        }
    }
    constructor(building: Building) {
        this.building = building
    }
}
export class Building {
    type: string
    readonly tile: Tile
    storage: BuildingStorage
    facingx: number = 1
    facingy: number = 0
    get info() {
        return buildingTypes.get(this.type)
    }
    canOutputItem(item: string) {
        if (!this.info) return false
        return this.info.canOutputItem(this, item)
    }
    toJSON() {
        return {t: this.type, s: this.storage.toJSON(), fx: this.facingx, fy: this.facingy}
    }
    fromJSON(obj: any) {
        this.type = obj.t
        this.facingx = obj.fx
        this.facingy = obj.fy
        this.storage.items = (obj.s.items || []).map((el: any) => ({item: el.i, amount: BigInt(el.a)}))
        //@ts-ignore
        this.storage.items = Object.values(obj.s.liquid).map(el => ({type: el.t, amount: el.a}))
    }
    update(x: number, y: number) {
        if (!this.info) return
        this.info.update(this, x, y)
    }
    constructor(type: string, tile: Tile) {
        this.type = type
        this.tile = tile
        this.storage = new BuildingStorage(this)
    }
}
export class Tile {
    type: string
    map: GameMap
    owner?: string
    building?: Building
    get info() {
        return tileTypes.get(this.type)
    }
    destroyBuilding(user?: User) {
        if (user) {
            var u = getUser(user)
            for (var stack of this.building?.info?.buildCost || []) {
                addItem(user, { item: stack.item, amount: stack.amount / 2n })
            }
        }
        this.building = undefined
    }
    fromString(str: string) {
        this.type = charToTile[str[0]]
        if (str.length > 1) {
            this.building = new Building("basic-drill", this)
            this.building.fromJSON(JSON.parse(str.slice(1)))
        }
    }
    constructor(type: string, map: GameMap) {
        this.type = type
        this.map = map
    }
}
export class GameMap extends Grid<Tile> {
    constructor(width: number, height: number) {
        super(width, height, (x, y, grid) => {
            return new Tile("grass", grid as GameMap)
        })
    }
    * iterateRect(x: number, y: number, w: number, h: number) {
        for (var y_ = y; y_ < h; y_++) {
            for (var x_ = x; x_ < w; x_++) {
                yield {
                    x: x_,
                    y: y_,
                    tile: this.get(x_, y_)
                }
            }
        }
    }
    * iterateBitArray(array: BitArray2D) {
    for (var y_ = 0; y_ < array.width; y_++) {
        for (var x_ = 0; x_ < array.height; x_++) {
            if (array.get2D(x_, y_)) yield {
                x: x_,
                y: y_,
                tile: this.get(x_, y_)
            }
        }
    }
    }
    getOwner(x: number, y: number) {
        var t = this.get(x, y)
        return t?.owner
    }
    fromString(str: string) {
        var split = str.split("|")
        for (var i = 0; i < split.length; i++) {
            if (split[i] == " ") continue
            if (split[i] == "") continue
            var t = this.getIndex(i)
            if (t) {
                t.fromString(split[i])
            }
        }
    }
    toString() {
        var t = [...this.iterateRect(0, 0, this.width, this.height)]
        return t.map(el => {
            if (!el.tile) return " "
            var str = tileToChar[el.tile.type]
            if (el.tile.building) {
                str += JSON.stringify(el.tile.building)
            }
            return str
        }).join("|")
    }
}
export var map: GameMap = new GameMap(512, 512)
var scale = 7.5
for (var t of map.iterateRect(0, 0, map.width, map.height)) {
    if (t.tile) {
        var v = ((stoneNoise.noise2D(t.x / scale, t.y / scale) + 1) / 2 * 0.75)
         + ((stoneNoise2.noise2D(t.x / scale, t.y / scale) + 1) / 2 * 0.25)

        var w = (waterNoise.noise2D(t.x / scale / 1.2, t.y / scale / 1.2) + 1) / 2

        
        if (v >= 0.6) t.tile.type = "stone"
        if (t.tile.type == "stone") {
            w *= 0.75
            var v2 = (oreNoise.noise2D(t.x / scale, t.y / scale) + 1) / 2
            if (v > 0.9 || v2 >= 0.7) t.tile.type = "copper-ore"
        }
        if (w >= 0.67) t.tile.type = "water"
    }
}