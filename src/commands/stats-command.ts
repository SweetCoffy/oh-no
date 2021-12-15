import { Command } from "../command-loader.js"
import { items } from "../helditem.js";
import { getString } from "../locale.js";
import { getPresetList, makeStats, getPreset } from "../stats.js";
import { getUser } from "../users.js";
import { bar } from "../util.js"
function getWeighted(weights: number[], total: number = 600) {
    var totalW = weights.reduce((prev, cur) => prev + cur, 0)
    var ar = []
    for (var w of weights) {
        ar.push(w / totalW * total)
    }
    return ar
}
export var command: Command = {
    type: "CHAT_INPUT",
    name: "stats",
    description: "Does stuff with stats",
    options: [
        {
            type: "SUB_COMMAND",
            name: "generate",
            description: "Generate stats from weight values",
            options: [
                {
                    name: "hp",
                    type: "NUMBER",
                    description: "Health",
                    required: false,
                },
                {
                    name: "atk",
                    type: "NUMBER",
                    description: "Attack",
                    required: false,
                },
                {
                    name: "def",
                    type: "NUMBER",
                    description: "Defense",
                    required: false,
                },
                {
                    name: "spatk",
                    type: "NUMBER",
                    description: "Special Attack",
                    required: false,
                },
                {
                    name: "spdef",
                    type: "NUMBER",
                    description: "Special Defense",
                    required: false,
                },
                {
                    name: "spd",
                    type: "NUMBER",
                    description: "Speed",
                    required: false,
                },
                {
                    name: "total",
                    type: "NUMBER",
                    description: "a",
                    required: false,
                },
                {
                    name: "held_items",
                    type: "STRING",
                    description: "A comma separated list of held items",
                    required: false
                },
            ]
        },
        {
            type: "SUB_COMMAND",
            name: "presets",
            description: "Shows a list of presets, including both your own and default",
        },
        {
            type: "SUB_COMMAND",
            name: "held_items",
            description: "Sets your held items",
            options: [
                {
                    name: "items",
                    type: "STRING",
                    description: "A comma separated list of held items",
                    required: false
                },
            ]
        },
        {
            type: "SUB_COMMAND",
            name: "preset",
            description: "Shows info about a preset",
            options: [
                {
                    name: "preset",
                    type: "STRING",
                    description: "The preset",
                    required: true
                }
            ]
        },
        {
            type: "SUB_COMMAND",
            name: "create",
            description: "Creates a preset",
            options: [
                {
                    name: "name",
                    type: "STRING",
                    description: "The name of the preset",
                    required: true
                },
                {
                    name: "json",
                    type: "STRING",
                    description: "The JSON data of the preset (use /stats generate to get it)",
                    required: true
                },
            ]
        },
        {
            type: "SUB_COMMAND",
            name: "use",
            description: "Uses a preset",
            options: [
                {
                    name: "preset",
                    type: "STRING",
                    description: "The preset to use",
                    required: true
                }
            ]
        },
    ],
    async run(i) {
        switch (i.options.getSubcommand(true)) {
            case "generate": {
                var weights: number[] = []
                var highest = "hp"
                var highestI = 0
                var highestVal = 0
                for (var k in makeStats()) {
                    var val = i.options.getNumber(k) || 1
                    weights.push(val)
                    if (val > highestVal) {
                        highestVal = val
                        highest = k
                        highestI = weights.length - 1
                    }
                }
                var maxTotal = i.options.getNumber("total", false) || 600
                var stats = getWeighted(weights, maxTotal).map(el => Math.floor(el))
                var total = stats.reduce((prev, cur) => prev + cur, 0)
                var missing = maxTotal - total
                stats[highestI] += missing
                await i.reply(`${Object.keys(makeStats()).map((el, i) => `\`${el.padEnd(6, " ")} ${stats[i].toString().padStart(3, " ")} ${bar(stats[i], 300)}\``).join("\n")}\nJSON: ${JSON.stringify({weights: weights, helditems: (i.options.getString("held_items", false) || "").split(",").map(el => el.trim())})}`)
                break;
            }
            case "presets": {
                var list = getPresetList(i.user)
                await i.reply(`Presets:\n${Object.keys(list).map(el => `${list[el].name} (\`${el}\`)`).join("\n")}`)
                break;
            }
            case "preset": {
                var p = getPreset(i.options.getString("preset", true), i.user)
                if (!p) return await i.reply(`Preset not found`)
                let stats = p.stats
                // @ts-ignore
                await i.reply(`${Object.keys(stats).map((el) => `\`${el.padEnd(6, " ")} ${stats[el].toString().padStart(3, " ")} ${bar(stats[el], 300)}\``).join("\n")}\nItems: ${(p.helditems || []).join(", ") || "None"}`)
                break;
            }
            case "create": {
                var name = i.options.getString("name", true)
                var json = i.options.getString("json", true)
                var id = name.toLowerCase().replace(/[^A-Za-z_\-0-9]/g, "-")
                var ar = [1, 1, 1, 1, 1, 1]
                var o = JSON.parse(json)
                for (var j = 0; j < o.weights.length; j++) {
                    ar[j] = o.weights[j] || 1
                }
                var statsAr = getWeighted(ar).map(el => Math.floor(el))
                var highestJ = 0
                let highest = 0
                for (var j = 0; j < statsAr.length; j++) {
                    if (statsAr[j] > highest) {
                        highest = statsAr[j]
                        highestJ = statsAr[j]
                    }
                }
                var total = statsAr.reduce((prev, cur) => prev + cur, 0)
                var missing = 600 - total
                statsAr[highestJ] += missing
                let stats = makeStats()
                var j = 0
                for (var k in makeStats()) {
                    stats[k] = statsAr[j++]
                }
                getUser(i.user).presets[id] = {
                    name: name,
                    stats: stats,
                    helditems: (o.helditems || []).filter((el: string) => items.has(el)).slice(0, 4)
                }
                await i.reply(`Created preset ${name} (\`${id}\`)\n${Object.keys(stats).map(el => `${el}: ${stats[el]}`).join("\n")}`)
                break
            }
            case "use": {
                var id = i.options.getString("preset", true)
                var p = getPreset(id, i.user)
                if (!p) return await i.reply("Unknown preset")
                var u = getUser(i.user)
                var total = Object.values(p.stats).reduce((prev, cur) => prev + cur, 0)
                if (total > 600) return await i.reply(`Illegal preset, base stat total must not exceed 600`)
                u.baseStats = {...p.stats}
                console.log(p.helditems)
                u.helditems = p.helditems || []
                u.preset = id
                await i.reply(`Selected preset: ${p.name}`)
                break;
            }
            case "held_items": {
                let item = i.options.getString("items", false)
                let u = getUser(i.user)
                if (item) {
                    u.helditems = item.split(",").map(el => el.trim()).filter(el => items.has(el))
                }
                await i.reply(`Items: ${u.helditems.join(", ")}`)
                break;
            }
        }
    }
}