import { Start, Reset, color2ANSIAlias, color2ANSITable, LogColor, LogColorWAccent } from "./ansi.js"
import { ActionRowBuilder, APIActionRowComponent, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, Collection, CommandInteraction, ComponentType, ContextMenuCommandInteraction, Message, StringSelectMenuBuilder } from "discord.js"
import { abilities } from "./abilities.js"
import { ItemResponse, ItemStack, shopItems } from "./items.js"
import { BASE_STAT_TOTAL } from "./params.js"
import { statSync, readdirSync } from "fs"
import { load } from "./content-loader.js"
import { items } from "./helditem.js"
import { readFileSync } from "fs"
import { UserInfo } from "./users.js"
import { calcStats, StatID } from "./stats.js"
import { getString } from "./locale.js"
import { Battle, Player, teamEmojis } from "./battle.js"
import { fnum, fracfmt } from "./number-format.js"
import { huntData } from "./save_special.js"
import { getAvailableContentForLevel, getBaseMpForLevel, getLevelCap, unlockContent, UnlockMeta } from "./unlocking.js"

export function lexer(str: string) {
    let ar: string[] = []
    let acc: string = ""
    let quotes = "\'\""
    let quote = ""
    for (let i = 0; i < str.length; i++) {
        let c = str[i]
        if (c == "\\") {
            let char = str[++i]
            if (char == "n") char = "\n"
            if (char == "t") char = "\t"
            acc += char
            continue;
        }
        if (c == " " && !quote) {
            if (acc) {
                ar.push(acc)
                acc = ""
            }
            continue
        }
        if (quotes.includes(c) && !quote) {
            quote = c;
            continue
        } else if (c == quote) {
            quote = "";
            ar.push(acc)
            acc = ""
            continue
        }
        acc += c;
    }
    if (acc) ar.push(acc)
    return ar;
}
/**
 * Sets the properties from `src` to `dst`
 * @param src The source object
 * @param dst The destination object
 * @returns A reference to `dst`
 */
export function setKeys(src: any, dst: any) {
    for (let k in src) {
        dst[k] = src[k]
    }
    return dst
}
export class RNG {
    seed: number
    constructor(seed?: number) {
        this.seed = seed ?? Date.now()
    }
//     get() {
//         const maxvalue = 0xffffffff
//         this.seed = (this.seed ^ (this.seed << 13)) % maxvalue
//         this.seed = (this.seed ^ (this.seed >> 17)) % maxvalue
//         this.seed = (this.seed ^ (this.seed << 5)) % maxvalue
//         this.seed = Math.abs(this.seed % 0xffffffff)
//         return this.seed
//    }
    get01() {
        return Math.random()
        //return (this.get() / 0xffffffff) % 1
    }
}
export let rng = new RNG()
export function randomRange(min: number, max: number) {
    let v = rng.get01()
    return (min * v) + (max * (1 - v))
}
export function randomChance(chance: number) {
    return rng.get01() < chance
}
export function snapTo(num: number, mult = 100) {
    let snapped = Math.abs(Math.round(num * mult) / mult)
    return snapped
}
export function barDelta(num: number, prevNum: number, max: number, width: number = 25) {
    let deltaFill = "🮘"
    let c = 0
    let fill = "█"
    let bg = " "
    let partialFill = ["▉", "▊", "▋", "▌", "▍", "▎", "▏"]

    let str = ""
    if (!Number.isFinite(num)) {
        str += "∞"
        num = 1
        max = 1
    }
    else {
        if (num - 0.1 > max) {
            str += `${Math.floor(num / max * 100)}%`
        }
    }
    width -= str.length;
    let chars = Math.ceil((((num - 0.1) / max) * width) % width)
    while (c < chars) {
        let f = fill
        let remainder = 1
        if (c + 1 >= chars && num % max != 0) remainder = num / max * width % 1
        if (remainder < 1) f = partialFill[0]
        if (remainder < 7 / 8) f = partialFill[1]
        if (remainder < 3 / 4) f = partialFill[2]
        if (remainder < 5 / 8) f = partialFill[3]
        if (remainder < 1 / 2) f = partialFill[4]
        if (remainder < 3 / 8) f = partialFill[5]
        if (remainder < 1 / 4) f = partialFill[6]
        c++
        str += f
    }
    while (c < width) {
        c++
        if (c <= prevNum/max*width) {
            str += deltaFill
        } else {
            str += bg
        }
    }
    return str
}
export function indent(str: string, amount: number = 1) {
    let indent = " ".repeat(amount)
    return str.split("\n").map(line => indent + line).join("\n")
}
export function bar(num: number, max: number, width: number = 25) {
    return barDelta(num, 0, max, width)
}
export function abs(number: bigint | number) {
    if (number < 0n) return -number
    return number
}
export async function itemResponseReply(res: ItemResponse, i: CommandInteraction | ContextMenuCommandInteraction) {
    if (!res.reason) {
        res = {
            type: "info",
            reason: "The item did not have a use response"
        }
    }
    let funi = {
        embeds: [
            {
                title: (res.type == "fail") ? "Failed using item" : undefined,
                description: res.reason
            }
        ]
    }
    if (i.replied) {
        if (res.edit) return await i.editReply(funi)
        return await i.followUp(funi)
    }
    else return await i.reply(funi)
}
export function lerp(a: number, b: number, x: number) {
    return a * x + b * (1 - x)
}
let date = new Date()
export let experimental = {
    // ansi_logs now works well enough and doesn't break on mobile, so it's now 
    // enabled by default and can't be turned off

    // ohyes_stat_formula shouldn't have even been an option in the first place

    // Now automatically set
    april_fools: date.getDate() == 1 && date.getMonth() == 4,
    codegen: false,
    // for the battle info message,
    // use an image generated by `canvas` instead of text (experimental)
    battle_info_canvas: true,
    test_canvas: false,
}
export let settings = {
    ownerID: "",
    noSave: false,
    experimental: false,
    unloadTimeout: 10 * 60 * 1000,
    saveprefix: experimental.april_fools ? "fools_" : "",
    maxMoves: 7,
    leftoverMp: 1,
    accentColor: 0x15deff,
}
export class BitArray extends Uint8Array {
    getBit(bit: number) {
        let byte = Math.floor(bit / 8)
        let b = bit % 8
        let val = 0b1000_0000 >> b
        return (this[byte] & val) > 0
    }
    setBit(bit: number, value = true) {
        let byte = Math.floor(bit / 8)
        let b = bit % 8
        let val = 0b1000_0000 >> b
        if (value) this[byte] = this[byte] | val
        else this[byte] = this[byte] & ~val
    }
    * bits() {
        for (let i = 0; i < this.length * 8; i++) {
            yield this.getBit(i)
        }
    }
    getBits() {
        return [...this.bits()]
    }
}
export class BitArray2D extends BitArray {
    readonly width: number
    readonly height: number
    constructor(w: number, h: number) {
        super(Math.ceil((w * h) / 8))
        this.width = w
        this.height = h
    }
    get2D(x: number, y: number) {
        if (x >= this.width || x < 0) return false
        if (y >= this.height || y < 0) return false
        return this.getBit(x + (this.width * y))
    }
    set2D(x: number, y: number, value: boolean = true) {
        if (x >= this.width || x < 0) return
        if (y >= this.height || y < 0) return
        this.setBit(x + (this.width * y), value)
    }
    setAll(func: (x: number, y: number, value: boolean, bitArray: BitArray2D) => boolean) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.set2D(x, y, func(x, y, this.get2D(x, y), this))
            }
        }
    }
}
// https://blobfolio.com/2019/randomizing-weighted-choices-in-javascript/
export function weightedRandom<T>(data: [T, number][], randomFunc = Math.random) {
    let total = 0;
    for (let i = 0; i < data.length; ++i) {
        total += data[i][1];
    }
    const threshold = randomFunc() * total;
    total = 0;
    for (let i = 0; i < data.length - 1; ++i) {
        total += data[i][1];
        if (total >= threshold) {
            return data[i][0];
        }
    }
    return data[data.length - 1][0];
}
export function weightedDistribution(weights: number[], total: number): number[] {
    let totalw = weights.reduce((prev, cur) => prev + cur, 0)
    return weights.map(el => el / totalw * total)
}
export type Dictionary<T> = { [key: string]: T }
export function max(...numbers: bigint[]): bigint {
    let m: bigint | undefined = undefined

    for (let num of numbers) {
        if (m == undefined || num > m) {
            m = num;
        }
    }
    return m || 0n
}
export function min(...numbers: bigint[]): bigint {
    let m: bigint | undefined = undefined

    for (let num of numbers) {
        if (m == undefined || num < m) {
            m = num;
        }
    }
    return m || 0n
}
export async function collectionAutocomplete<T extends { name: string }>
    (i: AutocompleteInteraction, c: Collection<string, T>) {
    let focused = i.options.getFocused(true)
    let query = focused.value.toLowerCase()
    let results = c.map((v, k) => ({ name: v.name, value: k }))
        .filter(v => v.name.toLowerCase().includes(query))
        .slice(0, 25)
    await i.respond(results)
}
export async function dictAutocomplete<T extends { name: string }>
    (i: AutocompleteInteraction, c: { [k in string]: T }) {
    let focused = i.options.getFocused(true)
    let query = focused.value.toLowerCase()
    let results = Object.entries(c).map(([k, v]) => ({ name: v.name, value: k }))
        .filter(v => v.name.toLowerCase().includes(query))
        .slice(0, 25)
    await i.respond(results)
}
let idCounter = 0
const ID_MAX = 2 ** 16 - 1
export function getID(): string {
    let counter = idCounter = (++idCounter % ID_MAX)
    return counter.toString(16).padStart(4, "0")
}
let nameI = Date.now()
let names = readFileSync("names.txt", "utf8").split("\n").filter(el => !!el)
export function getName() {
    nameI = nameI % names.length
    let n = names[nameI]
    nameI += 1 + Math.floor(Math.random() * 4)
    return n
}
export function getMaxTotal({ ability }: { ability?: string }) {
    if (!ability) return BASE_STAT_TOTAL;
    return BASE_STAT_TOTAL - (abilities.get(ability)?.cost ?? 0)
}
export function subscriptNum(num: number | string) {
    let str = num + ""
    return [...str].map(el => String.fromCharCode((el.charCodeAt(0) - 32) + 0x2070)).join("")
}
export function xOutOfY(x: number, y: number, color?: boolean) {
    let xstr = fnum(x)
    let ystr = fnum(y)
    let longest = Math.max(xstr.length, ystr.length)
    if (color) return `${xstr.padStart(longest, " ")}/[u]${ystr.padEnd(longest, " ")}[r]`
    return `${x.toString().padStart(longest, " ")}/${y.toString().padEnd(longest, " ")}`
}
export function name(name: string) {
    return `[a]${name}[r]`
}
export function loadRecursive(path: string) {
    let files = readdirSync(path)
    for (let f of files) {
        if (f.startsWith("exp_") && !settings.experimental) continue
        if (statSync(`${path}/${f}`).isDirectory()) {
            loadRecursive(`${path}/${f}`)
            continue
        }
        if (f.endsWith(".yml")) {

            load(`${path}/${f}`)
        }
    }
}
export function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
    let newSet = new Set<T>()
    for (let item of a.values()) {
        if (!b.has(item)) {
            newSet.add(item)
        }
    }
    for (let item of b.values()) {
        if (!a.has(item)) {
            newSet.add(item)
        }
    }
    return newSet
}
export function levelUpMessage(u: UserInfo, oldLevel: number, newLevel: number) {
    let hunt = huntData.get(u)
    let baseStats = u.baseStats
    let levelCap = getLevelCap(hunt.bossesDefeated)
    let oldMp = getBaseMpForLevel(oldLevel)
    let newMp = getBaseMpForLevel(newLevel)
    let oldUnlocks = getAvailableContentForLevel(oldLevel)
    let newUnlocks = getAvailableContentForLevel(newLevel)
    let oldStats = calcStats(oldLevel, baseStats)
    let newStats = calcStats(newLevel, baseStats)
    let unlocks: UnlockMeta[] = []
    for (let kind in newUnlocks) {
        let newList = newUnlocks[kind]
        let oldList = oldUnlocks[kind]
        let col = unlockContent[kind]
        let diff = new Array(...setDifference(newList, oldList))
        unlocks.push(...diff.map(k => col.get(k)!))
    }
    return formatString(`${"Level".padEnd(12)} [a]${oldLevel.toString().padStart(5)}[r] -> [s]${newLevel.toString().padEnd(5)}[r]/${levelCap}\n`) + "—".repeat(27) + "\n" +
        Object.keys(newStats).map(stat => {
            let old = oldStats[stat as StatID]
            let newStat = newStats[stat as StatID]
            return formatString(`${getString("stat." + stat).padEnd(12)} [a]${fnum(old).padStart(5)}[r] -> [s]${fnum(newStat).padEnd(5)}[r]`)
        }).join("\n")
         + "\n" + "—".repeat(27) + "\n"
         + (oldMp != newMp ? `\nMove Points increased to ${newMp}✦!` : "")
         + (unlocks.length > 0 ? `\nNew stuff unlocked!\n${unlocks.map(v => v.name).join(", ")}` : "")
}
export function timeFormat(seconds: number) {
    let secs = Math.floor(seconds % 60)
    let minutes = Math.floor(seconds / 60) % 60
    let hours = Math.floor(seconds / 60 / 60)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}
export async function confirmation(i: CommandInteraction | ButtonInteraction, str: string) {
    let components: APIActionRowComponent<any>[] = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("YES").setCustomId("yes").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setLabel("NO").setCustomId("no").setStyle(ButtonStyle.Danger),
    ).toJSON()]
    let reply: Message
    if (i.replied) reply = await i.followUp({
        content: str,
        components,
        fetchReply: true,
    }) as Message
    else reply = await i.reply({
        content: str,
        components,
        fetchReply: true,
    }) as Message
    try {
        let int = await reply.awaitMessageComponent({
            componentType: ComponentType.Button,
            filter: (interaction) => {
                if (interaction.user.id != i.user.id) {
                    interaction.reply({ content: "This isn't for you", ephemeral: true })
                    return false
                }
                return true
            },
            time: 1000 * 60
        })
        await int.deferUpdate().catch(() => { })
        return int.customId == "yes"
    } catch (e) {
        return false
    }
}
export function helditemString(id: string) {
    let type = items.get(id)
    return `${type?.icon ? type.icon + " " : ""}${type?.name || "???"}`
}

export function colorToANSI(color: string) {
    if (color in color2ANSIAlias) color = color2ANSIAlias[color]
    return color2ANSITable[color as LogColorWAccent] ?? 0
}
export function formatString(str: string, color: LogColorWAccent = "white") {
    return `${Start}0;${colorToANSI(color)}m` + str.replace(/(\w):(.+?);/g, function (substr, macro: string, arg: string) {
        if (macro == "n") return name(arg)
        return arg
    }).replace(/\[(.+?)\]/g, function (substr, format: string) {
        if (format == "reset" || format == "r") return `${Start}0;${colorToANSI(color)}m`;
        return `${Start}0;${colorToANSI(format as LogColor)}m`
    }) + Reset
}
export function playerSelectorComponent(player: Player, battle: Battle, customId: string, defaultPlayerId: string = "") {
    let targets = battle.players
    return new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setMaxValues(1)
        .setMinValues(1)
        .setPlaceholder("Select a target.")
        .setOptions(targets.map(v => {
            return {
                label: v == player ? v.name + " (You)" : (v.name + (battle.isEnemy(player, v) ? " 🔴" : " 🔵")),
                emoji: teamEmojis[v.team],
                value: v.id,
                default: v.id == defaultPlayerId,
                description: `HP: ${fnum(v.hp)}/${fnum(v.maxhp)} (${fracfmt.format(v.hp / v.maxhp)})`,
            }
        }))
}
const specialRegex = /\[\w+\]|[a-zA-Z]\:.+;|\$\.[a-zA-Z_]+/gm
const fRegex = /{(\d+)}/gm
export function owoSpecial(str: string) {
    let list: string[] = []
    let replaced = str.replaceAll(specialRegex, (sub) => {
        list.push(sub)
        return `{${list.length - 1}}`
    }).toLowerCase()
    .replaceAll("r", "w")
    .replaceAll("l", "w")
    .replaceAll("ck", "k")
    .replaceAll(/[bcdfghjklmnpqrstvxz]t/gm, "t")
    .replaceAll(/([bcdfghjklmnpqrstvxz])e\b/gm, "$1")
    return replaced.replaceAll(fRegex, (_sub, g1) => {
        return list[parseInt(g1)]
    })
}