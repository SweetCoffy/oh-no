import { ApplicationCommandType, ApplicationCommandOptionType, ChatInputCommandInteraction, codeBlock, ModalBuilder, StringSelectMenuBuilder, ContainerBuilder, ActionRowBuilder, TextDisplayBuilder, User, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import { abilities } from "../../abilities.js";
import { Command } from "../../command-loader.js"
import { ItemClass, items } from "../../helditem.js";
import { getString } from "../../locale.js";
import { getPresetList, makeStats, getPreset, presets, StatID, limitStats, calcStat, calcStats, StatPreset } from "../../stats.js";
import { applyPreset, getTempData, getUser } from "../../users.js";
import { bar, confirmation, getMaxTotal, helditemString, indent } from "../../util.js"
function getWeighted(weights: number[], total: number = 600) {
    let totalW = weights.reduce((prev, cur) => prev + cur, 0)
    let ar = []
    for (let w of weights) {
        ar.push(w / totalW * total)
    }
    return ar
}
function statAllocationComponent(user: User, presetId: string) {
    function statSelectComponent(cid: string, min: number, max: number) {
        let keys = Object.keys(makeStats()) as StatID[]
        return new StringSelectMenuBuilder().setCustomId(cid)
        .setMinValues(min)
        .setMaxValues(max)
        .setOptions(keys.map(k => ({ value: k, label: getString("stat." + k) })))
    }
    let root = new ContainerBuilder()
    let presetList = getUser(user).presets
    let preset = presetList[presetId]
    if (!preset) {
        root.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Invalid preset.")
        )
        return [root]
    }
    root.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("## Primary Stat"))
    root.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(statSelectComponent("stats:allocation_main", 1, 1)))
    root.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("## Secondary Stats"))
    root.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(statSelectComponent("stats:allocation_secondary", 0, 2)))
    root.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("## Tertiary Stats"))
    root.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(statSelectComponent("stats:allocation_tertiary", 0, 2)))

    return [root, new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder().setLabel("Save").setCustomId("stats:allocation_save").setStyle(ButtonStyle.Primary)
        )]
}
function heldItemComponent(user: User, presetId: string) {
    let root = new ContainerBuilder()
    let root2 = new ContainerBuilder()
    let preset = getPreset(presetId, user)
    let presetList = getUser(user).presets
    if (!preset) {
        root.addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Invalid preset.")
        )
        return [root]
    }
    let defaults = new Set(preset.helditems || [])
    function itemSelectComponent(itemClass: ItemClass) {
        let options = [
            { value: "none", label: "None", default: false },
            ...items.filter(v => v.class == itemClass).map((v, k) => ({ value: k, label: v.name, emoji: v.icon, default: defaults.has(k) }))
        ]
        if (options.every(v => !v.default)) {
            options[0].default = true
        }
        let itemSelect = new StringSelectMenuBuilder()
            .setCustomId("stats:item_" + itemClass)
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(options)
        return itemSelect
    }
    root.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("# Preset"))
    root.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder()
                .setCustomId("stats:preset")
                .setMinValues(1)
                .setMaxValues(1)
                .setDisabled(true)
                .setOptions(Object.keys(presetList).map(k => {
                    let v = presetList[k]
                    return {
                        value: k,
                        label: v.name,
                        emoji: "🏷️",
                        default: presetId == k
                    }
                }))))

    root.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("# Ability"))
    let abilityOptions = [
        { value: "none", label: "None", default: false },
        ...abilities.map((v, k) => ({ value: k, label: v.name, default: preset.ability == k }))
    ]
    if (abilityOptions.every(v => !v.default)) {
        abilityOptions[0].default = true
    }
    root.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(new StringSelectMenuBuilder()
                .setCustomId("stats:ability")
                .setMinValues(1)
                .setMaxValues(1)
                .setOptions(abilityOptions)))

    root2.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("# Items\n### Bruh Orb\nPlaceholder"))
    root2.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(itemSelectComponent("bruh_orb")))

    root2.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("### Offense\nEffects are triggered when dealing damage or using moves."))
    root2.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(itemSelectComponent("offense")))

    root2.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("### Defense\nEffects are triggered when taking damage."))
    root2.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(itemSelectComponent("defense")))

    root2.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent("### Passive\nEffects are automatically triggered every turn."))
    root2.addActionRowComponents(
        new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(itemSelectComponent("passive")))
    return [root, root2,
        new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder().setLabel("Save").setCustomId("stats:save_preset").setStyle(ButtonStyle.Primary)
            )]
}
function normPresetName(name: string) {
    return name.toLowerCase().replace(/[^A-Za-z_\-0-9 ]/g, "-")
}
export let command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "stats",
    description: "Does stuff with stats",
    associatedCustomIds: ["stats:"],
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "allocate",
            description: "Set stat allocation for a preset",
            options: [
                {
                    name: "preset",
                    type: ApplicationCommandOptionType.String,
                    description: "Preset",
                    required: true,
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "presets",
            description: "Show a list of presets, including premade and custom ones.",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "held_items",
            description: "Set held items and ability for a preset",
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
    async interaction(i) {
        if (i.user.id != i.message.interactionMetadata?.user.id) {
            return await i.reply({ flags: ["Ephemeral"], content: "Nope" })
        }
        if (!i.message.interactionMetadata?.id) {
            return await i.reply({ flags: ["Ephemeral"], content: "huh?" })
        }
        if (i.customId.startsWith("stats:allocation")) {
            let u = getUser(i.user)
            let tmp = getTempData(i.message.interactionMetadata?.id, "allocation", { main: [], secondary: [], tertiary: [] })
            let preset = u.presets[tmp.preset]
            if (!preset) return await i.reply({ flags: ["Ephemeral"], content: "huh??" })
            if (i.isStringSelectMenu()) {
                switch (i.customId) {
                    case "stats:allocation_main":
                        tmp.main = i.values
                        break
                    case "stats:allocation_secondary":
                        tmp.secondary = i.values
                        break
                    case "stats:allocation_tertiary":
                        tmp.tertiary = i.values
                        break
                }
            }
            if (i.customId == "stats:allocation_save") {
                let stats = makeStats()
                let primaryWeight = 100 / tmp.main.length
                let secondaryWeight = 60 / tmp.secondary.length
                let tertiaryWeight = 30 / tmp.tertiary.length
                for (let k of tmp.main) {
                    stats[k as StatID] += primaryWeight
                }
                for (let k of tmp.secondary) {
                    stats[k as StatID] += secondaryWeight
                }
                for (let k of tmp.tertiary) {
                    stats[k as StatID] += tertiaryWeight
                }
                stats = limitStats(stats, getMaxTotal(preset))
                preset.stats = stats
                if (tmp.preset == u.preset) {
                    applyPreset(i.user, tmp.preset)
                }
                await i.reply({
                    flags: ["Ephemeral"],
                    content: `## Final Base Stats:\n` + codeBlock("ansi", Object.keys(stats).map(k => {
                        return `${getString("stat." + k).padEnd(12)} ${stats[k as StatID]}`
                    }).join("\n"))
                })
            }
            await i.deferUpdate()
            return
        }
        let tmp = getTempData(i.message.interactionMetadata?.id, "stats", {})
        if (!tmp.preset) return await i.reply({ flags: ["Ephemeral"], content: "huh??" })
        if (i.isStringSelectMenu()) {
            if (i.customId == "stats:preset") {
                let preset = i.values[0]
                await i.update({ components: heldItemComponent(i.user, preset) })
                return
            }
            if (i.customId.startsWith("stats:item_")) {
                let v = i.values[0]
                let itemClass = i.customId.slice("stats:item_".length) as ItemClass
                if (v != "none") {
                    tmp.itemSlots[itemClass] = v
                }
            }
            if (i.customId == "stats:ability") {
                let ability = i.values[0]
                if (ability != "none") {
                    tmp.ability = ability
                } else {
                    tmp.ability = undefined
                }
            }
        }
        if (i.isButton()) {
            if (i.customId == "stats:save_preset") {
                let preset = getPreset(tmp.preset, i.user)
                if (!preset) return await i.reply({ flags: ["Ephemeral"], content: "huh???" })
                preset.ability = tmp.ability
                //@ts-ignore
                preset.helditems = Object.values(tmp.itemSlots).filter(el => el)
                let total = getMaxTotal(preset)
                preset.stats = limitStats(tmp.stats, total)
                tmp = getTempData(i.message.interactionMetadata?.id)
                delete tmp.data.stats
                let u = getUser(i.user)
                if (tmp.preset == u.preset) {
                    applyPreset(i.user, tmp.preset)
                }
                return await i.reply({ flags: ["Ephemeral"], content: "Saved." })
            }
        }
        await i.deferUpdate()
    },
    async autocomplete(i) {
        let focus = i.options.getFocused(true)
        if (focus.name == "ability") return await i.respond(abilities.map((v, k) => ({ value: k, name: v.name })))
        return await i.respond([])
    },
    async run(i: ChatInputCommandInteraction) {
        switch (i.options.getSubcommand()) {
            case "allocate": {
                let presetId = i.options.getString("preset", true)
                let u = getUser(i.user)
                let preset = u.presets[presetId]
                if (!preset) return await i.reply("Unknown preset")
                let tmp = getTempData(i.id, "allocation", {
                    preset: presetId,
                    main: [],
                    secondary: [],
                    tertiary: []
                })
                tmp.preset = presetId
                let components = statAllocationComponent(i.user, presetId)
                await i.reply({ flags: ["IsComponentsV2"], components })
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
                let statsL50 = calcStats(50, stats)
                let abilityInfo = p.ability ? abilities.get(p.ability) : null
                let json = JSON.stringify({weights: Object.values(p.stats), helditems: p.helditems, ability: p.ability})
                let maxStat = Math.max(...Object.values(stats))
                let maxDisp = Math.ceil(maxStat / 150) * 150
                let string = codeBlock("ansi", `${"Base".padEnd(40)}Level 50` + "\n" + Object.keys(statsL50).map((key) => {
                    let statL50 = statsL50[key as StatID]
                    let stat = stats[key as StatID]
                    return `${getString("stat." + key).padEnd(12)} ${stat.toString().padStart(3)}|${bar(stat, maxDisp, 20)}|`.padEnd(40) + `${statL50}`
                }).join("\n")
                    + `\n\nAbility: ${abilityInfo === null ? "None" : abilityInfo?.name || "Invalid"}\n`
                    + (abilityInfo ? `${indent(abilityInfo.description, 4)}\n` : "")
                    + `Held Items:\n${p.helditems?.length ? p.helditems.map(v => {
                        let iteminfo = items.get(v)
                        if (!iteminfo) return "· Invalid"
                        return `· ${iteminfo.name}\n${indent(iteminfo.passiveEffect, 4)}`
                    }).join("\n") : "None"}`)
                // @ts-ignore
                await i.reply(`Preset: **${p.name}**\n${string}\nJSON: \`${json}\``)
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
                let id = normPresetName(name)
                let existing = getUser(i.user).presets[id]
                if (existing) {
                    return await i.followUp("A preset of the same name already exists.")
                }
                let stats = makeStats()
                let keys = Object.keys(stats)
                for (let i in keys) {
                    //@ts-ignore
                    stats[keys[i]] = 1
                }
                stats = limitStats(stats, getMaxTotal({}))
                getUser(i.user).presets[id] = {
                    name: name,
                    stats: stats,
                    helditems: [],
                    ability: undefined,
                }
                await i.reply(`Created empty preset ${name} (\`${id}\`). Use \`/stats allocate preset:${id}\` to set stat allocation and \`/stats held_item preset:${id}\` to set items and abilities.`)
                break
            }
            case "use": {
                let id = i.options.getString("preset", true)
                let p = getPreset(id, i.user)
                if (!p) return await i.reply("Unknown preset")
                applyPreset(i.user, id)
                await i.reply(`Selected preset: ${p.name}`)
                break;
            }
            case "held_items": {
                let item = i.options.getString("items", false)
                let u = getUser(i.user)
                let presetId = i.options.getString("preset", false) as string
                let preset = u.presets[presetId]
                if (!preset && i.options.getString("preset", false)) return await i.reply(`Unknown preset`)
                let itemList
                if (item) {
                    itemList = item.split(",").map(el => el.trim()).filter(el => items.has(el))
                } else {
                    if (preset) {
                        let roots = heldItemComponent(i.user, presetId)
                        let tmp = getTempData(i.id)
                        let slots: any = {}
                        if (preset.helditems) {
                            for (let item of preset.helditems) {
                                let itemType = items.get(item)
                                if (!itemType) continue
                                slots[itemType.class] = item
                            }
                        }
                        tmp.data = {
                            stats: { preset: presetId, ability: preset.ability, itemSlots: slots, stats: preset.stats }
                        }
                        await i.reply({ flags: ["IsComponentsV2"], components: roots })
                        return
                    }
                }
                if (itemList) {
                    if (preset) {
                        preset.helditems = itemList
                    } else u.helditems = itemList
                } else {
                    await i.reply(`Items: ${u.helditems.join(", ")}`)
                }
                break;
            }
            case "ability": {
                let u = getUser(i.user)
                let a = i.options.getString("ability", false) || undefined
                let preset = u.presets[i.options.getString("preset", false) as string]
                if (!preset && i.options.getString("preset", false)) return await i.reply(`Unknown preset`)
                if (preset) {
                    preset.ability = a
                    let prevtotal = Object.values(preset.stats).reduce((prev, cur) => prev + cur, 0)
                    let total = getMaxTotal({ ability: a })
                    for (let k in preset.stats) {
                        preset.stats[k as StatID] = Math.floor(preset.stats[k as StatID] / prevtotal * total)
                    }
                    await i.reply(`Ability set to ${abilities.get(a as string)?.name || "None"}\nYou might have to do /stats use <preset> again to apply changes`)
                    return
                }
                if (!abilities.has(a as string ) && a) await i.reply(`Unknown ability: ${a}`)

                let total = getMaxTotal({ ability: a })
                u.ability = a;
                u.baseStats = limitStats(u.baseStats, total)
                await i.reply(`Ability set to ${abilities.get(a as string)?.name || "None"}`)
                break;
            }
        }
    }
}