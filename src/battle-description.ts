import { load } from "./content-loader.js"
import { getString } from "./locale.js"
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
    mod(stats: { [x in StatID]?: number }) {
        let sorted = Object.entries(stats).sort(([_0, a], [_1, b]) => b - a)
        for (let [stat, v] of sorted) {
            let percent = (v - 1) * 100
            let snapped = Math.abs(Math.round(percent * 100) / 100)
            if (percent >= 0) {
                this.text += `· [s]Increases [a]${getString("stat." + stat)}[r] by [a]${snapped}%[r]\n`
            } else {
                this.text += `· [f]Decreases [a]${getString("stat." + stat)}[r] by [a]${snapped}%[r]\n`
            }
        }
        return this
    }
}