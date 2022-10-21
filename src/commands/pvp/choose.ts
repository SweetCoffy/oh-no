import { createLobby, findValidLobby, lobbies } from '../../lobby.js';
import { Command, commands } from '../../command-loader.js'
import { getUser, users } from '../../users.js';
import { APIEmbedField, ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { moves } from '../../moves.js';
import { getString, LocaleString } from '../../locale.js';
import { StatID, Stats } from "../../stats.js";
import { items } from '../../helditem.js';
export var command: Command = {
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
        }
    ],
    async autocomplete(i) {
        var u = getUser(i.user)
        if (!u.lobby?.battle) return await i.respond([])
        var play = u.lobby.battle.players.find(el => el.user?.id == i.user.id)
        if (!play) return await i.respond([])

        var focused = i.options.getFocused(true)
        if (focused.name == "move") {
            var list = moves.filter((v, k) => v.selectable && play?.moveset.includes(k) || false).filter((v, k) => v.name.split(" ").some(el => el.toLowerCase().startsWith(focused.value as string)))
            await i.respond(list.map((v, k) => ({ value: k, name: v.name })))
        } else if (focused.name == "target") {
            var c = commands.get("info")
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
            var split = name.split(" ")
            var num = parseInt(split[0])
            return num || Number(name)
        }
        if (!(i.channel instanceof TextChannel)) return await i.reply("What")
        var u = getUser(i.user)
        switch (i.options.getSubcommand()) {
            case "move": {
                if (!u.lobby?.battle) return await i.reply("You cannot choose outside of battle")
                var moveId = findMoveID(i.options.getString("move", true))
                var move = moves.get(moveId)
                if (!move) return await i.reply(`Invalid move`)
                var idx = findPlayerID(i.options.getString("target", true));
                var player = u.lobby.battle.players[idx]
                //var player = u.lobby.battle.players.find(el => el.user?.id == target.id)
                if (!player) return await i.reply("Invalid target")
                var play = u.lobby.battle.players.find(el => el.user?.id == i.user.id)
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
                u.lobby.battle.moveAction(play, moveId, player)
                if (u.lobby.battle.isPve && u.lobby.users.length > 1) {
                    await i.reply({
                        content: `${i.user.username} has chosen the move ${move?.name} targeted at \`#${idx}\` ${player.name}`
                    })
                } else {
                    await i.reply({
                        ephemeral: true,
                        content: "k"
                    })
                }
                break;
            }
            case "help": {
                var moveId = i.options.getString("move", true);
                var move = moves.get(moveId)
                if (move) {
                    var desc = `**Power**: ${move.power || "-"}\n**Accuracy**: ${move.accuracy}%\n**Category**: ${move.category}`
                    if (move.type == "attack") desc += `\n**Damage Type**: ${move.setDamage}`
                    function thing(num: number) {
                        if (num > 0) return `+${num}`
                        return `${num}`
                    }
                    function funi(boost: Stats) {
                        return Object.keys(boost).map(el => ({stat: el, boost: boost[el as StatID]})).filter(el => el.boost != 0)
                    }
                    var userStat = funi(move.userStat)
                    var targetStat = funi(move.targetStat)
                    var fields: APIEmbedField[] = []
                    fields.push({
                        name: "General info",
                        value: `${desc}`
                    })
                    if (userStat.length) {
                        fields.push({
                            name: `User stat changes`,
                            value: `**Chance**: ${Math.floor(move.userStatChance * 100)}%\n` + userStat.map(el => {
                                return `**${getString("stat." + el.stat as LocaleString)}**: ${thing(el.boost)}`
                            }).join("\n")
                        })
                    }
                    if (targetStat.length) {
                        fields.push({
                            name: `Target stat changes`,
                            value: `**Chance**: ${Math.floor(move.targetStatChance * 100)}%\n` + targetStat.map(el => {
                                return `**${getString("stat." + el.stat as LocaleString)}**: ${thing(el.boost)}`
                            }).join("\n")
                        })
                    }
                    if (move.requiresMagic || move.requiresCharge) {
                        fields.push({
                            name: "Charge/Magic",
                            value: `Requires ${move.requiresCharge} charge and ${move.requiresMagic} magic`
                        })
                    }
                    await i.reply({
                        embeds: [{
                            title: `${move.name}`,
                            description: `${move.description || "No description provided"}`,
                            fields: fields
                        }]
                    })
                } else return new Error(`Unknown move: '${moveId}'`)
                break;
            }
            case "item_info": {
                var item = items.get(i.options.getString("item", true))
                if (!item) return await i.reply("wh")
                await i.reply({
                    embeds: [{
                        title: `${item.icon || "❓"} ${item.name}`,
                        description: `**Effect**: ${item.passiveEffect || "N/A"}\n**ID**: ${i.options.getString("item", true)}`
                    }]
                })
                break;
            }
        }
    }
}