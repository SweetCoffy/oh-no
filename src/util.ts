import { ButtonInteraction, Collection, CommandInteraction, ContextMenuInteraction, Interaction, Message, MessageActionRow, MessageButton } from "discord.js"
import { abilities } from "./abilities.js"
import { formats } from "./formats.js"
import { ItemResponse, ItemStack, shopItems } from "./items.js"
import { BASE_STAT_TOTAL } from "./params.js"
import { statSync, readdirSync } from "fs"
import { load } from "./content-loader.js"
import { items } from "./helditem.js"
import { setupOwO } from "./locale.js"
export const CURRENCY_ICON = "$"
export function lexer(str: string) {
    var ar: string[] = []
    var acc: string = ""
    var quotes = "\'\""
    var quote = ""
    for (var i = 0; i < str.length; i++) {
        var c = str[i]
        if (c == "\\") {
            var char = str[++i]
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
    for (var k in src) {
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
        this.seed = this.seed % (2**32 / 2)
        return (this.seed++ % 512) + ((this.seed++) % 256) + ((this.seed++ * 1.5) % 128) + ((this.seed++ * 2) % 128)
    }
    get01() {
        return this.get() / 1024
    }
}
export var rng = new RNG()
export function randomRange(min: number, max: number) {
    var v = (rng.get() + rng.get() + rng.get() + rng.get()) / 4096
    return (min * v) + (max * (1 - v))
}
export function randomChance(chance: number) {
    return rng.get01() < chance
}
export function bar(num: number, max: number, width: number = 25) {
    var c = 0
    var fill = "█"
    var bg = " "

    var things = ["▉", "▊", "▋", "▌", "▍", "▎", "▏"]

    var str = ""
    str += "+".repeat(Math.min(Math.max(Math.floor((num - 0.01) / max), 0), width - 1))
    width -= str.length;
    var chars = Math.ceil((((num - 0.01) / max) * width) % (width))
    while (c < chars) {
        var f = fill
        var epicVal = 1
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
        str += bg
    }
    return str
}
export function abs(number: bigint | number) {
    if (number < 0n) return -number
    return number
}
export function format(number: bigint) {
    var funi = null
    for (var f of formats) {
      if (abs(number) >= f.min) funi = f
    }
    if (!funi) return `${number}`
    var m = number / funi.min
    var d = abs((number % funi.min) / (funi.min / 100n))
	function yes(num: bigint) {
		var str = num.toString()
		var a = str.slice(0, 4)
		var count = str.length - 4
		return `${a}e${count}`
	  }
	if (abs(number) > funi.min * 1000n) return `${yes(number)}`
    return `${m}.${d}${funi.suffix}`
}
export async function itemResponseReply(res: ItemResponse, i: CommandInteraction | ContextMenuInteraction) {
    if (!res.reason) {
        res = {
            type: "info",
            reason: "The item did not have a use response"
        }
    }
    var funi = {
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
	return a*x + b*(1-x)
}
export var settings = {
	ownerID: "",
  	noSave: false,
    experimental: false,
    unloadTimeout: 2 * 60 * 1000,
    saveprefix: "",
}
export class BitArray extends Uint8Array {
	getBit(bit: number) {
	 	var byte = Math.floor(bit / 8)
	 	var b = bit % 8
	 	var val = 0b1000_0000 >> b
	  	return (this[byte] & val) > 0
	}
	setBit(bit: number, value = true) {
	  	var byte = Math.floor(bit / 8)
	  	var b = bit % 8
	  	var val = 0b1000_0000 >> b
	  	if (value) this[byte] = this[byte] | val
	  	else this[byte] = this[byte] & ~val
	}
	* bits() {
		for (var i = 0; i < this.length * 8; i++) {
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
		for (var y = 0; y < this.height; y++) {
			for (var x = 0; x < this.width; x++) {
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
    var totalw = weights.reduce((prev, cur) => prev + cur, 0)
    return weights.map(el => el / totalw * total)
}
export type Dictionary<T> = {[key: string]: T}
export function max(...numbers: bigint[]): bigint {
    var m: bigint | undefined = undefined

    for (var num of numbers) {
        if (m == undefined || num > m) {
            m = num;
        }
    }
    return m || 0n
}
export function min(...numbers: bigint[]): bigint {
    var m: bigint | undefined = undefined

    for (var num of numbers) {
        if (m == undefined || num < m) {
            m = num;
        }
    }
    return m || 0n
}

export var experimental = {
    ansi_logs: true,
    ohyes_stat_formula: true,
    april_fools: false,
}
export function money(amount: bigint) {
    return `${CURRENCY_ICON}${format(amount)}`
}
var idCounter = 0;
export function getID(max: number) {
    return (idCounter++ % max).toString().padStart((max - 1).toString().length, "0");
}
export function getMaxTotal({ ability }: { ability?: string }) {
    if (!ability) return BASE_STAT_TOTAL;
    return BASE_STAT_TOTAL - (abilities.get(ability)?.cost ?? 0)
}
export function subscriptNum(num: number | string) {
    var str = num + ""
    return [...str].map(el => String.fromCharCode((el.charCodeAt(0) - 32) + 0x2070)).join("")
}
export function xOutOfY(x: number, y: number) {
    let longest = Math.max(x.toString().length, y.toString().length)
    return `${x.toString().padStart(longest, " ")}/${y.toString().padEnd(longest, " ")}`
}
export function loadRecursive(path: string) {
    var files = readdirSync(path)
    for (var f of files) {
        if (f.startsWith("exp_") && !settings.experimental) continue
        if (statSync(`${path}/${f}`).isDirectory()) {
            loadRecursive(`${path}/${f}`)
            continue
        }
        if (f.endsWith(".balls") || f.endsWith(".owo") || f.endsWith(".yml")) {
            
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
    let components = [new MessageActionRow().addComponents(
        new MessageButton().setLabel("YES").setCustomId("yes").setStyle("SUCCESS"),
        new MessageButton().setLabel("NO").setCustomId("no").setStyle("DANGER"),
    )]
    var reply: Message
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
    let int = await reply.awaitMessageComponent({
        componentType: "BUTTON",
        filter: (interaction) => {
            if (interaction.user.id != i.user.id) {
                interaction.reply({ content: "This isn't for you", ephemeral: true })
                return false
            }
            return true
        },
        time: 1000 * 60
    })
    if (int) await int.deferUpdate()
    return int?.customId == "yes"
}
export function helditemString(id: string) {
    let type = items.get(id)
    return `${type?.icon ? type.icon + " ": ""}${type?.name || "???"}`
}