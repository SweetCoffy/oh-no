import { FG_Cyan, FG_Green, FG_Red, FG_Yellow, FG_Gray, FG_Blue, FG_Pink, Start, Reset, color2ANSIAlias, color2ANSITable, LogColor, LogColorWAccent } from "./ansi.js"
import { ActionRowBuilder, APIActionRowComponent, ButtonBuilder, ButtonInteraction, ButtonStyle, CommandInteraction, ComponentType, ContextMenuCommandInteraction, Message } from "discord.js"
import { abilities } from "./abilities.js"
import { formats } from "./formats.js"
import { ItemResponse, ItemStack, shopItems } from "./items.js"
import { BASE_STAT_TOTAL } from "./params.js"
import { statSync, readdirSync } from "fs"
import { load } from "./content-loader.js"
import { items } from "./helditem.js"
import { readFileSync } from "fs"
export const CURRENCY_ICON = "$"
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
    get() {
        this.seed += Math.floor((this.seed % 512) + ((this.seed % 2048) * 1.535)) + 8192
        this.seed = this.seed % (2 ** 32 / 2)
        return (this.seed++ % 512) + ((this.seed++) % 256) + ((this.seed++ * 1.5) % 128) + ((this.seed++ * 2) % 128)
    }
    get01() {
        return this.get() / 1024
    }
}
export let rng = new RNG()
export function randomRange(min: number, max: number) {
    let v = (rng.get() + rng.get() + rng.get() + rng.get()) / 4096
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
    let things = ["▉", "▊", "▋", "▌", "▍", "▎", "▏"]

    let str = ""
    if (!Number.isFinite(num)) {
        str += "∞"
        num = 1
        max = 1
    }
    else {
        if (num - 0.01 > max) {
            str += `${Math.floor(num / max * 100)}%`
        }
    }
    width -= str.length;
    let chars = Math.ceil((((num - 0.01) / max) * width) % (width))
    while (c < chars) {
        let f = fill
        let epicVal = 1
        if (c + 1 >= chars && num % max != 0) epicVal = num / max * width % 1
        if (epicVal < 1) f = things[0]
        if (epicVal < 7 / 8) f = things[1]
        if (epicVal < 3 / 4) f = things[2]
        if (epicVal < 5 / 8) f = things[3]
        if (epicVal < 1 / 2) f = things[4]
        if (epicVal < 3 / 8) f = things[5]
        if (epicVal < 1 / 4) f = things[6]
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
export function dispDelta(amount: number, color = false) {
    let str = amount < 0 ? `${amount}` : `+${amount}`
    if (color) {
        if (amount == 0) {
            str = `[u]${str}[r]`
        }
        else if (amount > 0) {
            str = `[s]${str}[r]`
        } else {
            str = `[f]${str}[r]`
        }
    }
    return str
}
export function indent(str: string, amount: number = 1) {
    let indent = " ".repeat(amount)
    return str.split("\n").map(line => indent + line).join("\n")
}
export function dispMul(mul: number, asDelta = true, color = false) {
    let str
    if (asDelta) {
        let am = `${((mul - 1) * 100).toFixed(1)}%`
        if (mul >= 1.0) {
            am = `+${am}`
        }
        str = am
    } else {
        str = `×${(mul * 100).toFixed(1)}%`
    }
    if (color) {
        if (mul == 1) {
            str = `[u]${str}[r]`
        }
        else if (mul > 1) {
            str = `[s]${str}[r]`
        } else {
            str = `[f]${str}[r]`
        }
    }
    return str
}
export function bar(num: number, max: number, width: number = 25) {
    return barDelta(num, 0, max, width)
}
export function abs(number: bigint | number) {
    if (number < 0n) return -number
    return number
}
export function format(number: bigint) {
    let funi = null
    for (let f of formats) {
        if (abs(number) >= f.min) funi = f
    }
    if (!funi) return `${number}`
    let m = number / funi.min
    let d = abs((number % funi.min) / (funi.min / 100n))
    function yes(num: bigint) {
        let str = num.toString()
        let a = str.slice(0, 4)
        let count = str.length - 4
        return `${a}e${count}`
    }
    if (abs(number) > funi.min * 1000n) return `${yes(number)}`
    return `${m}.${d}${funi.suffix}`
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
    codegen: false
}
export let settings = {
    ownerID: "",
    noSave: false,
    experimental: false,
    unloadTimeout: 2 * 60 * 1000,
    saveprefix: experimental.april_fools ? "fools_" : "",
    maxMoves: 5,
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
export function weightedRandom<T>(data: [T, number][]) {
    let total = 0;
    for (let i = 0; i < data.length; ++i) {
        total += data[i][1];
    }
    const threshold = Math.random() * total;
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

export function money(amount: bigint) {
    return `${CURRENCY_ICON}${format(amount)}`
}
let start = 9999
let idCounter = start
export function getID(max: number = 10000) {
    if (idCounter < 0) idCounter = start
    return (idCounter-- % max).toString().padStart((max - 1).toString().length, "0")
}
let names = readFileSync("names.txt", "utf8").split("\n")
export function getName() {
    let n = names.pop() as string
    names.unshift(n)
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
function formatNumber(n: number) {
    if (Number.isNaN(n)) return "?"
    if (!Number.isFinite(n)) return "∞"
    return n.toString()
}
export function xOutOfY(x: number, y: number, color?: boolean) {
    let xstr = formatNumber(x)
    let ystr = formatNumber(y)
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
