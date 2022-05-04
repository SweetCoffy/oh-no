import { Collection } from "discord.js"
import { statusTypes } from "./battle.js"
import { enemies } from "./enemies.js"
import { items } from "./helditem.js"
import { shopItems } from "./items.js"
import { moves } from "./moves.js"
import { experimental, loadRecursive, RNG } from "./util.js"
// April fools tomfoolery

var seed = 69
var rng = new RNG(seed)

function shuffleCollection(col: Collection<any, any>) {
    let names = [...col.keys()]
    let a = [...names]
    let rnames = []
    while (rnames.length < names.length) {
        let i = Math.floor(rng.get01() * a.length)
        rnames.push(a[i])
        a.splice(i, 1)
    }
    let old = col.clone()
    for (let i = 0; i < names.length; i++) {
        col.set(rnames[i], old.get(names[i]))
    }
    return col
}

// Get a list of all the stuff names
var names: string[] = []
var namecols: Collection<string, {name: string}>[] = [items, shopItems, enemies, statusTypes, moves]
for (var c of namecols) {
    for (var [k, v] of c) {
        names.push(v.name)
    }
}

console.log(names)

// Shuffle a whole bunch of collections
shuffleCollection(items)
shuffleCollection(shopItems)
shuffleCollection(moves)
shuffleCollection(enemies)
shuffleCollection(statusTypes)

var namesleft = new Set(names)
function getName() {
    var list = Array.from(namesleft)
    var i = Math.floor(rng.get01() * list.length)
    var name = list[i]
    namesleft.delete(name)
    return name ||  names[Math.floor(rng.get01() * names.length)];
}
for (var c of namecols) {
    for (var [k, v] of c) {
        v.name = getName()
        console.log(`${k}: ${v.name}`)
    }
}

// Randomize experimental flags
for (var k in experimental) {
    //@ts-ignore
    experimental[k] = rng.get01() < 0.5
}
experimental.april_fools = true

// April fools exclusive items and stuff shouldn't be shuffled by the tomfoolery
loadRecursive("april_fools")