import { formats } from "./formats.js"
import type { ExtendedStatID } from "./stats.js"

export const CURRENCY_ICON = "$"
export const numfmt = new Intl.NumberFormat("en-US", { style: "decimal", maximumFractionDigits: 2, signDisplay: "auto" })
export const fracfmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 })
export const numdeltafmt = new Intl.NumberFormat("en-US", { style: "decimal", maximumFractionDigits: 2, signDisplay: "always" })
export const fracdeltafmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2, signDisplay: "always" })

function abs(number: bigint | number) {
    if (number < 0n) return -number
    return number
}
export function fstat(value: number, stat: ExtendedStatID) {
    const percentStats: ExtendedStatID[] = ["dr", "crit", "critdmg", "chgbuildup", "magbuildup"]
    if (percentStats.includes(stat)) return ffrac(value / 100)
    return fnum(value)
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
export function money(amount: bigint) {
    return `${CURRENCY_ICON}${format(amount)}`
}
export function fmt(n: number, style: "decimal" | "percent") {
    return style == "decimal" ? fnum(n) : ffrac(n)
}
export function fnum(n: number) {
    if (Number.isNaN(n)) return "?"
    if (!Number.isFinite(n)) return "∞"
    return numfmt.format(n)
}
export function ffrac(n: number) {
    if (Number.isNaN(n)) return "?%"
    if (!Number.isFinite(n)) return "∞"
    return fracfmt.format(n)
}
export function dispDelta(amount: number, color = false) {
    let str = numdeltafmt.format(amount)
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
export function modStatDisp(base: number, final: number, color = false, stat?: ExtendedStatID) {
    let str
    if (stat == null) {
        str = numfmt.format(final)
    } else {
        str = fstat(final, stat)
    }
    if (color) {
        if (final == base) {
            str = `[a]${str}[r]`
        }
        else if (final > base) {
            str = `[s]${str}[r]`
        } else {
            str = `[f]${str}[r]`
        }
    }
    return str
}
export function dispMul(mul: number, asDelta = true, color = false) {
    let str
    if (asDelta) {
        let am = `${fracdeltafmt.format(mul - 1)}`
        str = am
    } else {
        str = `×${fracfmt.format(mul)}`
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