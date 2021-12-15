import { Collection, CommandInteraction, ContextMenuInteraction } from "discord.js"
import { ItemResponse, shopItems } from "./items.js"
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
    var chars = Math.min((num / max) * width, width)
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
    var formats = [
        { suffix: ' K', decimalPlaces: 2, min: 1000n },
        { suffix: ' M', decimalPlaces: 2, min: 1000000n },
        { suffix: ' B', decimalPlaces: 2, min: 1000000000n },
        { suffix: ' T', decimalPlaces: 2, min: 1000000000000n },
        { suffix: ' Qd', decimalPlaces: 2, min: 1000000000000000n },
        { suffix: ' Qn', decimalPlaces: 2, min: 1000000000000000000n },
        { suffix: ' Sx', decimalPlaces: 2, min: 1000000000000000000000n },
        { suffix: ' Sp', decimalPlaces: 2, min: 1000000000000000000000000n },
        {
          suffix: ' O',
          decimalPlaces: 2,
          min: 1000000000000000000000000000n
        },
        {
          suffix: ' N',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000n
        },
        {
          suffix: ' D',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000n
        },
        {
          suffix: ' Ud',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000n
        },
        {
          suffix: ' Dd',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000n
        },
        {
          suffix: ' Td',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Qdd',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Qnd',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Sxd',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Spd',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Od',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Nd',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Vg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' UVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' DVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' TVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' QdVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' QnVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' SxVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' SpVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' NVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' OVg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Tg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' UTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' DTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' TTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' QdTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' QnTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' SxTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' SpTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' OTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' NTg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' QDg',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        },
        {
          suffix: ' Cn',
          decimalPlaces: 2,
          min: 1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000n
        }
      ]
    var funi = null
    for (var f of formats) {
      if (abs(number) >= f.min) funi = f
    }
    if (!funi) return `${number}`
    var m = number / funi.min
    var d = abs((number % funi.min) / (funi.min / 100n))
    return `${m}.${d}${funi.suffix}`
}
export async function itemResponseReply(res: ItemResponse, i: CommandInteraction | ContextMenuInteraction, item: string, amount: bigint) {
    if (!res.reason) {
        var str = `Used ${shopItems.get(item)?.toString(amount)}`
        if (i.replied) return await i.followUp(str)
        else return await i.reply(str)
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
export var settings = {
	ownerID: ""
}