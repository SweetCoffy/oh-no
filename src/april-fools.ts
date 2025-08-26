import { Collection } from "discord.js"
import { statusTypes } from "./battle.js"
import { enemies } from "./enemies.js"
import { items } from "./helditem.js"
import { shopItems } from "./items.js"
import { moves } from "./moves.js"
import { experimental, loadRecursive, owoSpecial, RNG } from "./util.js"
import { abilities } from "./abilities.js"
// April fools tomfoolery

let seed = 69
let rng = new RNG(seed)

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
let names: string[] = []
let namecols: Collection<string, {name: string}>[] = [items, shopItems, enemies, statusTypes, moves, abilities]
for (let c of namecols) {
    for (let [k, v] of c) {
        names.push(v.name)
    }
}


// Shuffle a whole bunch of collections
shuffleCollection(items)
shuffleCollection(shopItems)
shuffleCollection(moves)
shuffleCollection(enemies)
shuffleCollection(statusTypes)
shuffleCollection(abilities)

let namesleft = new Set(names)
function getName() {
    let list = Array.from(namesleft)
    let i = Math.floor(rng.get01() * list.length)
    let name = list[i]
    namesleft.delete(name)
    return name ||  names[Math.floor(rng.get01() * names.length)];
}
for (let c of namecols) {
    for (let [k, v] of c) {
        v.name = getName()
        v.name = owoSpecial(v.name)
    }
}

// Randomize experimental flags
for (let k in experimental) {
    //@ts-ignore
    experimental[k] = rng.get01() < 0.5
}
experimental.april_fools = true
// April fools exclusive items and stuff shouldn't be shuffled by the tomfoolery
loadRecursive("april_fools")