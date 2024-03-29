import { ApplicationCommandType, ApplicationCommandOptionType, ChatInputCommandInteraction } from "discord.js";
import { abilities } from "../../abilities.js";
import { Command } from "../../command-loader.js"
import { items } from "../../helditem.js";
import { getString } from "../../locale.js";
import { getPresetList, makeStats, getPreset, presets, StatID } from "../../stats.js";
import { getUser } from "../../users.js";
import { bar, confirmation, getMaxTotal, helditemString } from "../../util.js"
function getWeighted(weights: number[], total: number = 600) {
    let totalW = weights.reduce((prev, cur) => prev + cur, 0)
    let ar = []
    for (let w of weights) {
        ar.push(w / totalW * total)
    }
    return ar
}
export let command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "stats",
    description: "Does stuff with stats",
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "generate",
            description: "Generate stats from weight values",
            options: [
                {
                    name: "hp",
                    type: ApplicationCommandOptionType.Number,
                    description: "Health",
                    required: false,
                },
                {
                    name: "atk",
                    type: ApplicationCommandOptionType.Number,
                    description: "Attack",
                    required: false,
                },
                {
                    name: "def",
                    type: ApplicationCommandOptionType.Number,
                    description: "Defense",
                    required: false,
                },
                {
                    name: "spatk",
                    type: ApplicationCommandOptionType.Number,
                    description: "Special Attack",
                    required: false,
                },
                {
                    name: "spdef",
                    type: ApplicationCommandOptionType.Number,
                    description: "Special Defense",
                    required: false,
                },
                {
                    name: "spd",
                    type: ApplicationCommandOptionType.Number,
                    description: "Speed",
                    required: false,
                },
                {
                    name: "total",
                    type: ApplicationCommandOptionType.Number,
                    description: "a",
                    required: false,
                },
                {
                    name: "held_items",
                    type: ApplicationCommandOptionType.String,
                    description: "A comma separated list of held items",
                    required: false
                },
                {
                    name: "ability",
                    type: ApplicationCommandOptionType.String,
                    description: "holy sheet",
                    required: false,
                    autocomplete: true
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "presets",
            description: "Shows a list of presets, including both your own and default",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "held_items",
            description: "Sets your held items",
            options: [
                {
                    name: "items",
                    type: ApplicationCommandOptionType.String,
                    description: "A comma separated list of held items",
                    required: false
                },
                {
                    name: "preset",
                    type: ApplicationCommandOptionType.String,
                    description: "A",
                    required: false,
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "ability",
            description: "Sets your ability",
            options: [
                {
                    name: "ability",
                    type: ApplicationCommandOptionType.String,
                    description: "A",
                    required: false,
                    autocomplete: true,
                },
                {
                    name: "preset",
                    type: ApplicationCommandOptionType.String,
                    description: "A",
                    required: false,
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "preset",
            description: "Shows info about a preset",
            options: [
                {
                    name: "preset",
                    type: ApplicationCommandOptionType.String,
                    description: "The preset",
                    required: false
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "create",
            description: "Creates a preset",
            options: [
                {
                    name: "name",
                    type: ApplicationCommandOptionType.String,
                    description: "The name of the preset",
                    required: true
                },
                {
                    name: "json",
                    type: ApplicationCommandOptionType.String,
                    description: "The JSON data of the preset (use /stats generate to get it)",
                    required: true
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "use",
            description: "Uses a preset",
            options: [
                {
                    name: "preset",
                    type: ApplicationCommandOptionType.String,
                    description: "The preset to use",
                    required: true
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "delete",
            description: "Deletes a preset",
            options: [
                {
                    name: "preset",
                    type: ApplicationCommandOptionType.String,
                    description: "The preset to delete",
                    required: true
                }
            ]
        },
    ],
    async autocomplete(i) {
        let focus = i.options.getFocused(true)
        if (focus.name == "ability") return await i.respond(abilities.map((v, k) => ({ value: k, name: v.name })))
        return await i.respond([])
    },
    async run(i: ChatInputCommandInteraction) {
        switch (i.options.getSubcommand()) {
            case "generate": {
                let weights: number[] = []
                let highest = "hp"
                let highestI = 0
                let highestVal = 0
                for (let k in makeStats()) {
                    let val = i.options.getNumber(k) || 1
                    weights.push(val)
                    if (val > highestVal) {
                        highestVal = val
                        highest = k
                        highestI = weights.length - 1
                    }
                }
                let maxTotal = i.options.getNumber("total", false) || getMaxTotal({ ability: i.options.getString("ability", false) || undefined })
                let stats = getWeighted(weights, maxTotal).map(el => Math.floor(el))
                let total = stats.reduce((prev, cur) => prev + cur, 0)
                let missing = maxTotal - total
                stats[highestI] += missing
                await i.reply(`${Object.keys(makeStats()).map((el, i) => `\`${el.padEnd(6, " ")} ${stats[i].toString().padStart(3, " ")} ${bar(stats[i], 300)}\``).join("\n")}\nJSON: \`${JSON.stringify(
                    {
                        weights: weights,
                        helditems: (i.options.getString("held_items", false) || "").split(",").map(el => el.trim()), 
                        ability: i.options.getString("ability", false)
                    })}\``)
                break;
            }
            case "presets": {
                let defaultPresets = presets;
                let userPresets = getUser(i.user).presets;
                let list = getPresetList(i.user)
                let presetInfo = (el: string) => `${list[el].name} (\`${el}\`)`
                await i.reply(`**Default Presets**:\n${defaultPresets.map((_, el) => presetInfo(el)).join("\n")}\n\n**Custom Presets**:\n${Object.keys(userPresets).map(el => presetInfo(el)).join("\n") || "None"}`)
                break;
            }
            case "preset": {
                let p = getPreset(i.options.getString("preset", false) || getUser(i.user).preset, i.user)
                if (!p) return await i.reply(`Preset not found`)
                let stats = p.stats
                let json = JSON.stringify({weights: Object.values(p.stats), helditems: p.helditems, ability: p.ability})
                // @ts-ignore
                await i.reply(`Preset: **${p.name}**\n${Object.keys(stats).map((el) => `\`${el.padEnd(6, " ")} ${stats[el].toString().padStart(3, " ")} ${bar(stats[el], 300)}\``).join("\n")}\nItems: ${(p.helditems || []).map(helditemString).join(", ") || "None"}\nAbility: ${abilities.get(p.ability)?.name || "None"}\nJSON: \`${json}\``)
                break;
            }
            case "delete": {
                let list = getPresetList(i.user);
                let preset = i.options.getString("preset", true)
                if (!(preset in list)) return await i.reply(`Invalid preset`);
                if (presets.has(preset)) return await i.reply(`Can't delete a default preset`);
                delete getUser(i.user).presets[preset];
                await i.reply(`Deleted the preset`);
                break;
            }
            case "create": {
                if (Object.keys(getPresetList(i.user)).length >= presets.size + 25) return await i.reply(`You can't create more than 25 presets`);
                let name = i.options.getString("name", true)
                let json = i.options.getString("json", true)
                let id = name.toLowerCase().replace(/[^A-Za-z_\-0-9 ]/g, "-")
                let existing = getUser(i.user).presets[id]
                if (existing) {
                    if (!await confirmation(i, `You are about to overwrite your existing '${existing.name}' preset. Are you sure you want to do that?`))
                        return await i.followUp(`Cancelled preset creation`)
                }
                let ar = [1, 1, 1, 1, 1, 1]
                let o = JSON.parse(json)
                for (let j = 0; j < o.weights.length; j++) {
                    ar[j] = o.weights[j] || 1
                }
                let statsAr = getWeighted(ar, getMaxTotal(o)).map(el => Math.floor(el))
                let highestJ = 0
                let highest = 0
                for (let j = 0; j < statsAr.length; j++) {
                    if (statsAr[j] > highest) {
                        highest = statsAr[j]
                        highestJ = statsAr[j]
                    }
                }
                let total = statsAr.reduce((prev, cur) => prev + cur, 0)
                let missing = getMaxTotal(o) - total
                statsAr[highestJ] += missing
                let stats = makeStats()
                let j = 0
                for (let k in makeStats()) {
                    stats[k as StatID] = statsAr[j++]
                }
                getUser(i.user).presets[id] = {
                    name: name,
                    stats: stats,
                    helditems: (o.helditems || []).filter((el: string) => items.has(el)).slice(0, 4),
                    ability: abilities.has(o.ability) ? o.ability : undefined,
                }
                if (existing) await i.followUp(`Overwrote preset '${existing.name}' with '${name}' (\`${id}\`)`)
                else await i.reply(`Created preset ${name} (\`${id}\`)`)
                break
            }
            case "use": {
                let id = i.options.getString("preset", true)
                let p = getPreset(id, i.user)
                if (!p) return await i.reply("Unknown preset")
                let u = getUser(i.user)
                let total = Object.values(p.stats).reduce((prev, cur) => prev + cur, 0)
                if (total > getMaxTotal(p)) return await i.reply(`Illegal preset, base stat total must not exceed the maximum allowed`)
                u.baseStats = {...p.stats}
                u.ability = p.ability
                u.helditems = p.helditems || []
                u.preset = id
                await i.reply(`Selected preset: ${p.name}`)
                break;
            }
            case "held_items": {
                let item = i.options.getString("items", false)
                let u = getUser(i.user)
                let preset = u.presets[i.options.getString("preset", false) as string]
                if (!preset && i.options.getString("preset", false)) return await i.reply(`Unknown preset`)
                if (item) {
                    if (preset) {
                        preset.helditems = item.split(",").map(el => el.trim()).filter(el => items.has(el))
                    } else u.helditems = item.split(",").map(el => el.trim()).filter(el => items.has(el))
                }
                await i.reply(`Items: ${u.helditems.join(", ")}`)
                break;
            }
            case "ability": {
                let u = getUser(i.user)
                let a = i.options.getString("ability", false) || undefined
                let preset = u.presets[i.options.getString("preset", false) as string]
                if (!preset && i.options.getString("preset", false)) return await i.reply(`Unknown preset`)
                if (preset) {
                    preset.ability = a
                    console.log(preset)
                    let prevtotal = Object.values(preset.stats).reduce((prev, cur) => prev + cur, 0)
                    let total = getMaxTotal({ ability: a })
                    for (let k in preset.stats) {
                        preset.stats[k as StatID] = Math.floor(preset.stats[k as StatID] / prevtotal * total)
                    }
                    console.log(preset)
                    await i.reply(`Ability set to ${abilities.get(a as string)?.name || "None"}\nYou might have to do /stats use <preset> again to apply changes`)
                    return
                }
                if (!abilities.has(a as string ) && a) await i.reply(`Unknown ability: ${a}`)
                
                let prevtotal = Object.values(u.baseStats).reduce((prev, cur) => prev + cur, 0)
                let total = getMaxTotal({ ability: a })
                u.ability = a;
                for (let k in u.baseStats) {
                    u.baseStats[k as StatID] = Math.floor(u.baseStats[k as StatID] / prevtotal * total)
                }
                await i.reply(`Ability set to ${abilities.get(a as string)?.name || "None"}`)
                break;
            }
        }
    }
}