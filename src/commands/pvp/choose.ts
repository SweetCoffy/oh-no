import { Command, commands } from '../../command-loader.js'
import { getTempData, getUser } from '../../users.js';
import { ActionRowBuilder, APIEmbedField, ApplicationCommandOptionChoiceData, ApplicationCommandOptionType, ApplicationCommandType, AutocompleteInteraction, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, codeBlock, Collection, StringSelectMenuBuilder, TextChannel } from 'discord.js';
import { Move, moves } from '../../moves.js';
import { getString } from '../../locale.js';
import { items } from '../../helditem.js';
import { abilities } from '../../abilities.js';
import { collectionAutocomplete, formatString, playerSelectorComponent, snapTo } from '../../util.js';
import { ffrac, dispDelta } from '../../number-format.js';
function moveDescription(move: Move, enhance: number = 1) {
    //@ts-ignore
    let desc = formatString(`Enhancement Level: [a]${enhance}[r] — [a]${"✦".repeat(enhance)}[r][u]${"✧".repeat(move.maxEnhance - enhance)}[r]\nAccuracy: [a]${ffrac(move.accuracy / 100)}[r]\nCategory: [a]${getString("move.category." + move.category)}[r]`)
    if (move.type == "attack") {
        //@ts-ignore
        desc += formatString(`\nDamage Type: [a]${getString("move.dmgtype." + move.setDamage)}[r]`)
        if (move.power) {
            let atkStat = move.category == "physical" ? "atk" : "spatk"
            let dispMult = ""
            let dispMultSuffix = ""
            let power = move.getBasePower(enhance)
            if (move.setDamage == "percent") {
                dispMult = `${ffrac(power / 100)}`
                dispMultSuffix = ` of target's [a]MAX HP[r]`
            }
            if (move.setDamage == "regular") {
                dispMult = `${ffrac(power / 100)}`
                dispMultSuffix = ` of [a]${getString("stat." + atkStat)}[r]`
            }
            if (move.multihit > 1) {
                dispMultSuffix += `total, across [a]${move.multihit}[r] hits`
            }
            desc += formatString(`\nDamage Multiplier: [a]${dispMult}[r]${dispMultSuffix}`)
        } else {
            desc += formatString(`\nDamage Multiplier: [a]Varies[r]`)
        }
    }
    desc += `\n\n${move.getDescription(enhance)}`
    if (move.requiresCharge) {
        desc += formatString(`\nThis move requires [a]${move.requiresCharge}[r] [red]Charge[r] to use.`)
    }
    if (move.requiresMagic) {
        desc += formatString(`\nThis move requires [a]${move.requiresMagic}[r] [blue]Magic[r] to use.`)
    }
    return desc
}
function enhanceLevelComponent(current: number, max: number, mid: string) {
    let actionRow = new ActionRowBuilder<ButtonBuilder>()
    for (let i = 1; i <= max; i++) {
        let button = new ButtonBuilder().setLabel(`${i}✦`).setCustomId(`choose:h/${mid}/${i}`)
        button.setDisabled(i == current)
        if (i == current) {
            button.setStyle(ButtonStyle.Secondary)
        } else {
            button.setStyle(ButtonStyle.Primary)
        }
        actionRow.addComponents(button)
    }
    return actionRow
}
export let command: Command = {
    name: "choose",
    description: "ur mom",
    type: ApplicationCommandType.ChatInput,
    associatedCustomIds: ["choose:"],
    options: [

        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Choose a move",
            name: "move",
            options: [
                {
                    name: "move",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    description: "The move to use",
                    autocomplete: true
                },
                {
                    name: "target",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    description: "The target of the move",
                    autocomplete: true,
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Shows info about a move",
            name: "help",
            options: [
                {
                    name: "move",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    description: "The move to show info about",
                    autocomplete: true,
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Shows info about an item",
            name: "item_info",
            options: [
                {
                    name: "item",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    description: "The item",
                    autocomplete: true,
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Shows info about an ability",
            name: "ability",
            options: [
                {
                    name: "ability",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    description: "The ability",
                    autocomplete: true,
                }
            ]
        }
    ],
    async interaction(i) {
        if (i.isButton()) {
            if (i.customId.startsWith("choose:h/")) {
                let splits = i.customId.split("/")
                let mid = splits[1]
                let e = Number(splits[2])
                let moveInfo = moves.get(mid)
                if (!moveInfo || isNaN(e)) {
                    return await i.reply({
                        flags: ["Ephemeral"],
                        content: "huh?"
                    })
                }
                let component = enhanceLevelComponent(e, moveInfo.maxEnhance, mid)
                return await i.update({
                    components: [component], embeds: [{
                        title: `${moveInfo.name}`,
                        description: codeBlock("ansi", moveDescription(moveInfo, e)),
                        //footer: move.maxEnhance > 1 ? { text: "Use the buttons below to view different Enhancement Levels." } : undefined
                    }]
                })
            }
        }
        let u = getUser(i.user)
        let battle = u.lobby?.battle
        if (!battle)
            return await i.reply({ flags: ["Ephemeral"], content: "What are you even doing." })
        let player = battle.players.find(el => el.user?.id == i.user.id)
        if (!player)
            return await i.reply({ flags: ["Ephemeral"], content: "????" })
        let tmp = getTempData(i.user.id, "choose", { move: null, target: null })
        let missingActions = battle.getMissingActionsFor(i.user)
        let first = missingActions[0]
        if (!first) {
            return await i.reply({ flags: ["Ephemeral"], content: ":(" })
        }
        let userPlayer = player
        player = first
        let moveset = player.moveset
        function moveSelectorComponent(moveset: string[]) {
            return new ActionRowBuilder<StringSelectMenuBuilder>()
                .setComponents(new StringSelectMenuBuilder()
                    .setCustomId("choose:move")
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setPlaceholder("Select a move.")
                    .setOptions(moveset.map(k => {
                        let info = moves.get(k)
                        return {
                            label: info?.name ?? "????",
                            value: k,
                            description: k,
                        }
                    })))
        }
        let mSelectorString = `Selecting for **${player.name}**.`
        if (i.isButton()) {
            if (i.customId == "choose:open_selector") {
                tmp.move = null
                return await i.reply({
                    flags: ["Ephemeral"], 
                    content: mSelectorString, 
                    components: [moveSelectorComponent(moveset)]
                })
            }
            if (i.customId == "choose:back") {
                tmp.move = null
                return await i.update({
                    content: mSelectorString,
                    components: [moveSelectorComponent(moveset)]
                })
            }
            if (i.customId == "choose:help") {
                let info = moves.get(tmp.move)
                if (!info) return i.reply({
                    flags: ["Ephemeral"],
                    content: ":("
                })
                return await i.reply({
                    flags: ["Ephemeral"],
                    content: codeBlock("ansi", moveDescription(info, player.getEnhanceLevel(tmp.move)))
                })
            }
        }
        if (i.isStringSelectMenu()) {
            
            if (i.customId == "choose:move") {
                tmp.move = i.values[0]
                let moveInfo = moves.get(tmp.move)
                if (!moveInfo)
                    return await i.reply({ flags: ["Ephemeral"], content: "What." })
                let warning = ""
                let veryBad = false
                if (moveInfo.requiresCharge > player.charge || moveInfo.requiresMagic > player.magic) {
                    warning = "\n⚠️ **You may not have enough resources to use this move.**"
                    veryBad = true
                }
                let extra = moveInfo.selectDialogExtra(battle, player, player.getEnhanceLevel(tmp.move))
                if (extra) {
                    warning += `\n${extra}`
                }
                await i.update({
                    content: `**${moveInfo.name}**` + warning + "\nSelect a target below.",
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>()
                            .setComponents(playerSelectorComponent(player, battle, "choose:target")),
                        new ActionRowBuilder<ButtonBuilder>()
                            .setComponents(new ButtonBuilder()
                                .setLabel("Back")
                                .setEmoji("↩️")
                                .setStyle(veryBad ? ButtonStyle.Primary : ButtonStyle.Secondary)
                                .setCustomId("choose:back"), new ButtonBuilder()
                                    .setLabel("Move Info")
                                    .setEmoji("ℹ️")
                                    .setStyle(ButtonStyle.Secondary)
                                    .setCustomId("choose:help"))
                    ]
                })
                return
            }
            if (i.customId == "choose:target") {
                if (!tmp.move)
                    return await i.reply({ flags: ["Ephemeral"], content: "????" })
                tmp.target = i.values[0]
                let moveInfo = moves.get(tmp.move)
                if (!moveInfo) return
                let target = battle.players.find(v => v.id == tmp.target)
                if (!target) return
                let p
                if (battle.isPve && u.lobby && u.lobby.users.length > 1) {
                    p = i.reply({
                        content: `${i.user.displayName} has chosen the move ${moveInfo.name} targeted at ${target.name}`
                    })
                } else {
                    if (missingActions.length > 1) {
                        p = i.update({
                            content: `Still missing actions for ${missingActions.length - 1} summon(s). Press **Attack** again to choose for your next summon.`,
                            components: []
                        })
                    } else {
                        p = i.update({
                            content: "Move selected.",
                            components: []
                        })
                    }
                }
                battle.moveAction(player, tmp.move, target)
                await p
                return
            }
        }
    },
    async autocomplete(i) {
        if (i.options.getSubcommand() == "help") {
            let focused = i.options.getFocused(true)
            if (focused.name != "move") return
            return await collectionAutocomplete(i, moves)
        }
        if (i.options.getSubcommand() == "item_info") {
            return await collectionAutocomplete(i, items)
        }
        if (i.options.getSubcommand() == "ability") {
            return await collectionAutocomplete(i, abilities)
        }
        let u = getUser(i.user)
        if (!u.lobby?.battle) return await i.respond([])
        let play = u.lobby.battle.players.find(el => el.user?.id == i.user.id)
        if (!play) return await i.respond([])

        let focused = i.options.getFocused(true)
        if (focused.name == "move") {
            let list = moves.filter((v, k) => play?.moveset.includes(k) || false).filter((v, k) => v.name.split(" ").some(el => el.toLowerCase().startsWith(focused.value as string)))
            await i.respond(list.map((v, k) => ({ value: k, name: v.name })))
        } else if (focused.name == "target") {
            let c = commands.get("info")
            if (typeof c?.autocomplete == "function") {
                return await c.autocomplete(i)
            }
        }
    },
    async run(i: ChatInputCommandInteraction) {
        function findMoveID(name: string) {
            return moves.findKey(el => el.name == name) || (moves.has(name) && name) || name
        }
        function findPlayerID(name: string) {
            let split = name.split(" ")
            let num = parseInt(split[0])
            return num || Number(name)
        }
        if (!(i.channel instanceof TextChannel)) return await i.reply("What")
        let u = getUser(i.user)
        switch (i.options.getSubcommand()) {
            case "move": {
                if (!u.lobby?.battle) return await i.reply("You cannot choose outside of battle")
                let moveId = findMoveID(i.options.getString("move", true))
                let move = moves.get(moveId)
                if (!move) return await i.reply(`Invalid move`)
                let idx = findPlayerID(i.options.getString("target", true));
                let player = u.lobby.battle.players[idx]
                //let player = u.lobby.battle.players.find(el => el.user?.id == target.id)
                if (!player) return await i.reply("Invalid target")
                let play = u.lobby.battle.players.find(el => el.user?.id == i.user.id)
                if (!play) return await i.reply("What")
                if (!play.moveset.includes(moveId)) return await i.reply(`This move is not in your moveset`)
                if (move) {
                    if (play.magic < move.requiresMagic) return await i.reply({
                        ephemeral: true,
                        content: `You don't have enough magik to use this move (required: ${move.requiresMagic}, have: ${play.magic})`
                    })
                    if (play.charge < move.requiresCharge) return await i.reply({
                        ephemeral: true,
                        content: `You don't have enough charge to use this move (required: ${move.requiresCharge}, have: ${play.charge})`
                    })
                }
                let battle = u.lobby.battle
                let p
                if (battle.isPve && u.lobby.users.length > 1) {
                    p = i.reply({
                        content: `${i.user.displayName} has chosen the move ${move?.name} targeted at \`#${idx}\` ${player.name}`
                    })
                } else {
                    p = i.reply({
                        ephemeral: true,
                        content: "k"
                    })
                }
                battle.moveAction(play, moveId, player)
                await p
                break;
            }
            case "help": {
                let moveId = i.options.getString("move", true);
                let move = moves.get(moveId)
                if (move) {
                    let components = []
                    if (move.maxEnhance > 1) {
                        components.push(enhanceLevelComponent(1, move.maxEnhance, moveId))
                    }
                    await i.reply({
                        flags: ["Ephemeral"],
                        embeds: [{
                            title: `${move.name}`,
                            description: codeBlock("ansi", moveDescription(move)),
                            //footer: move.maxEnhance > 1 ? { text: "Use the buttons below to view different Enhancement Levels." } : undefined
                        }],
                        components
                    })
                } else return new Error(`Unknown move: '${moveId}'`)
                break;
            }
            case "item_info": {
                let item = items.get(i.options.getString("item", true))
                if (!item) return await i.reply("wh")
                await i.reply({
                    embeds: [{
                        title: `${item.icon || "❓"} ${item.name}`,
                        description: codeBlock("ansi", `Item ID: ${i.options.getString("item", true)}\n${item.passiveEffect || "N/A"}`)
                    }]
                })
                break;
            }
            case "ability": {
                let ability = abilities.get(i.options.getString("ability", true))
                if (!ability) return await i.reply("wh")
                await i.reply({
                    embeds: [{
                        title: `${ability.name}`,
                        description: codeBlock("ansi", `BSP ${dispDelta(-ability.cost)}\n Ability ID: ${i.options.getString("ability", true)}\n${ability.description}`)
                    }]
                })
                break;
            }
        }
    }
}