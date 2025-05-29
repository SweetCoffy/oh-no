import { Command, commands } from '../../command-loader.js'
import { getUser } from '../../users.js';
import { APIEmbedField, ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, codeBlock, TextChannel } from 'discord.js';
import { moves } from '../../moves.js';
import { getString, LocaleString } from '../../locale.js';
import { StatID, Stats } from "../../stats.js";
import { items } from '../../helditem.js';
import { abilities } from '../../abilities.js';
import { dispDelta, formatString, snapTo } from '../../util.js';
export let command: Command = {
    name: "choose",
    description: "ur mom",
    type: ApplicationCommandType.ChatInput,
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
                    choices: moves.map((el, k) => ({name: el.name, value: k}))
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
                    choices: items.map((el, k) => ({ name: el.name, value: k }))
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
                    choices: abilities.map((el, k) => ({ name: el.name, value: k }))
                }
            ]
        }
    ],
    async autocomplete(i) {
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
                    //@ts-ignore
                    let desc = formatString(`Accuracy: [a]${move.accuracy}%[r]\nCategory: [a]${getString("move.category." + move.category)}[r]`)
                    if (move.type == "attack") {
                        //@ts-ignore
                        desc += formatString(`\nDamage Type: [a]${getString("move.dmgtype." + move.setDamage)}[r]`)
                        if (move.power) {
                            let atkStat = move.category == "physical" ? "atk" : "spatk"
                            let dispMult = ""
                            let dispMultSuffix = ""
                            if (move.setDamage == "percent") {
                                dispMult = `${snapTo(move.power)}%`
                                dispMultSuffix = ` of target's [a]MAX HP[r]`
                            }
                            if (move.setDamage == "regular") {
                                dispMult = `${snapTo(move.power)}%`
                                dispMultSuffix = ` of user's [a]${getString("stat." + atkStat)}[r] stat`
                            }
                            desc += formatString(`\nDamage Multiplier: [a]${dispMult}[r]${dispMultSuffix}`)
                        } else {
                            desc += formatString(`\nDamage Multiplier: [a]Varies[r]`)
                        }
                    }
                    desc += `\n\n${move.description}`
                    if (move.requiresCharge) {
                        desc += formatString(`\nThis move requires [a]${move.requiresCharge}[r] [red]Charge[r] to use.`)
                    }
                    if (move.requiresMagic) {
                        desc += formatString(`\nThis move requires [a]${move.requiresMagic}[r] [blue]Magic[r] to use.`)
                    }
                    await i.reply({
                        embeds: [{
                            title: `${move.name}`,
                            description: codeBlock("ansi", desc),
                        }]
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