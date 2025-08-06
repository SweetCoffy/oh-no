import { Collection } from "discord.js";
import { moves } from "./moves";
import { statusTypes } from "./battle";
import { items } from "./helditem";
import { abilities } from "./abilities";
import { formatString } from "./util";
export class WikiEntry {
    keywords: Set<string>
    constructor(public title: string, public content: string = "") {
        this.keywords = new Set()
    }
    addKw(...kw: string[]) {
        for (let k of kw) {
            this.keywords.add(k.toLowerCase())
        }
        return this
    }
    register() {
        wikiEntries.set(this.title, this)
        return this
    }
}
export const wikiEntries = new Collection<string, WikiEntry>()
export function search(query: string) {
    query = query.toLowerCase()
    let kw = query.split(" ")
    return wikiEntries.filter(v =>
        v.title.toString().toLowerCase().includes(query) || kw.some(k => v.keywords.has(k)))
        .map((_, k) => k)
}
function genWikiEntries<
    T extends { name: string, description: string, wikiHeader?: string }
>(prefix: string, c: Collection<string, T>) {
    for (let [_, v] of c) {
        let entry = new WikiEntry(prefix + v.name)
        if (v.wikiHeader) {
            entry.content += v.wikiHeader + "\n "
        }
        entry.content += v.description
        entry.register()
    }
}
new WikiEntry("Stat: CRIT Rate",
    formatString("Determines the chance of a critical hit. When it exceeds 100%, all attacks are guaranteed to be critical hits, and" +
        "the excess [a]CRIT Rate[r] is converted into [a]Super CRIT Rate[r].\n" +
        "When attacking before your target, the effective [a]CRIT Rate[r] is multiplied by [a]120%[r].\n" +
        "Initial [a]CRIT Rate[r] scales with Base [a]Speed[r], and any modifiers to [a]Speed[r] will further increase or decrease it."
    ))
    .register()
new WikiEntry("Stat: DR (Damage Reduction)", formatString("Reduces a fixed fraction of [a]all[r] incoming damage.\n"))
.register()
new WikiEntry("Stat: CRIT DMG", formatString("Determines the additional damage dealt by critical hits and super critical hits.\n" +
    "For critical hits, the damage multiplier is [a]100% + CRIT DMG[r], and for super critical hits, it is [a]100% + 2 × CRIT DMG[r]."
))
    .register()
new WikiEntry("Mechanic: Damage Types", formatString("Determines which [a]defensive stat[r], if any, the damage is affected by.\n" +
    "[a]Physical[r] damage is affected by [a]DEF[r], [a]Special[r] damage is affected by [a]Special DEF[r], and [a]Status[r] damage is unaffected."
)).register().addKw("special", "physical", "status")
new WikiEntry("Mechanic: Absorption", formatString("Given by certain moves or abilities, it acts as a barrier between the player's [a]HP[r] and incoming damage.\n" +
    "[a]Absorption[r] will always be reduced before [a]HP[r], reducing a fraction of the damage determined by its [a]Efficiency[r]. In cases where there are multiple sources of [a]Absorption[r] present, the one with the highest [a]Efficiency[r] will be used first."))
    .register()
new WikiEntry("Mechanic: Charge and Magic",
    formatString("The two resources used in battle, required to use certain [a]powerful moves[r].\n" +
        "[a]Charge[r] is gained by using [a]Physical[r] attacks or boosting your [a]ATK[r].\n" +
        "[a]Magic[r] is gained by using [a]Special[r] attacks, but at a slower rate than [a]Charge[r], or by using any [a]Status[r] move.\n" +
        "A player's initial [a]Charge[r] and [a]Magic[r] limits are determined by their initial [a]ATK[r]/[a]DEF[r] and [a]Special ATK[r]/[a]Special DEF[r] respectively."
    ))
    .register()
new WikiEntry("Mechanic: Action Order", formatString(
    "The action order is determined by the [a]Speed[r] stat of the players and the priorities of the queued moves." +
    "The action order may change mid-turn if [a]Speed[r] is modified."))
    .register()
genWikiEntries("Move: ", moves)
genWikiEntries("Status: ", statusTypes)
genWikiEntries("Item: ", items)
genWikiEntries("Ability: ", abilities)