import { Collection, CommandInteraction, ContextMenuInteraction } from "discord.js"
import { formats } from "./formats.js"
import { ItemResponse, ItemStack, shopItems } from "./items.js"
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
    var str = ""
    var chars = Math.ceil((((num - 0.01) / max) * width) % (width))
    str += "+".repeat(Math.max(Math.floor((num - 0.01) / max), 0))
    while (c < chars) {
        var f = fill
        var epicVal = Math.min(chars - c, 1)
        if (epicVal < 1)   f = "▉"
        if (epicVal < 7/8) f = "▊"
        if (epicVal < 3/4) f = "▋"
        if (epicVal < 5/8) f = "▌"
        if (epicVal < 1/2) f = "▍"
        if (epicVal < 3/8) f = "▎"
        if (epicVal < 1/4) f = "▏"
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
    if (i.replied) return await i.followUp(funi)
    else return await i.reply(funi)
}
export function lerp(a: number, b: number, x: number) {
	return a*x + b*(1-x)
}
export var settings = {
	ownerID: "",
  	noSave: false,
    experimental: false,
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
export function weightedRandom<T>(data: [T, number][]) {
    // https://blobfolio.com/2019/randomizing-weighted-choices-in-javascript/
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
    ansi_logs: false,
    bin_save: false,
    item_args_debug: false,
}
export function money(amount: bigint) {
    return `${CURRENCY_ICON}${format(amount)}`
}