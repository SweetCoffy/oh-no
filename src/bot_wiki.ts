import { Collection } from "discord.js";
import { moves } from "./moves";
import { statusTypes } from "./battle";
import { items } from "./helditem";
import { abilities } from "./abilities";
export class WikiEntry {
    content: string = ""
    keywords: Set<string>
    constructor(public title: string) {
        this.keywords = new Set()
    }
    register() {
        wikiEntries.set(this.title, this)
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
genWikiEntries("Move: ", moves)
genWikiEntries("Status: ", statusTypes)
genWikiEntries("Item: ", items)
genWikiEntries("Ability: ", abilities)