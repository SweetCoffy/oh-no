import { load } from "./content-loader.js"
import { getString, locale } from "./locale.js"
import { fracdeltafmt, numdeltafmt } from "./number-format.js"
import { StatID, Stats } from "./stats.js"
import { formatString } from "./util.js"
load("content/locale/en_us/pvp.yml")
export class DescriptionBuilder {
    private text: string = ""
    static new(): DescriptionBuilder {
        return new DescriptionBuilder()
    }
    constructor() {

    }
    build() {
        return this.text.split("\n").map(text => formatString(text)).join("\n").trim()
    }
    line(text: string) {
        this.text += text + "\n"
        return this
    }
    bruhOrbMod(boost: { mult: { [x in StatID]?: number }, add: { [x in StatID]?: number } }) {
        return this.mod(boost.mult).addMod(boost.add)
    }
    mod(stats: { [x in StatID]?: number }) {
        let sorted = Object.entries(stats).sort(([_0, a], [_1, b]) => b - a)
        for (let [stat, v] of sorted) {
            let percent = (v - 1)
            let snapped = fracdeltafmt.format(percent)
            let color = "u"
            if (percent > 0) color = "s"
            if (percent < 0) color = "f"
            this.text += `· [a]${getString("stat." + stat)}[r] [${color}]${snapped}[r]\n`
        }
        return this
    }
    addMod(stats: { [x in StatID]?: number }) {
        let sorted = Object.entries(stats).sort(([_0, a], [_1, b]) => b - a)
        for (let [stat, v] of sorted) {
            let snapped = numdeltafmt.format(v)
            let color = "u"
            if (v > 0) color = "s"
            if (v < 0) color = "f"
            this.text += `· [a]${getString("stat." + stat)}[r] [${color}]${snapped}[r]\n`
        }
        return this
    }
}