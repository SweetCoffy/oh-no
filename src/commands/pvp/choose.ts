import { createLobby, findValidLobby, lobbies } from '../../lobby.js';
import { Command } from '../../command-loader.js'
import { getUser, users } from '../../users.js';
import { EmbedFieldData, TextChannel } from 'discord.js';
import { moves } from '../../moves.js';
import { getString } from '../../locale.js';
import { Stats } from "../../stats.js";
export var command: Command = {
    name: "choose",
    description: "ur mom",
    type: "CHAT_INPUT",
    options: [

        {
            type: "SUB_COMMAND",
            description: "Choose a move",
            name: "move",
            options: [
                {
                    name: "move",
                    type: "STRING",
                    required: true,
                    description: "The move to use",
                    autocomplete: true
                },
                {
                    name: "target",
                    type: "INTEGER",
                    required: true,
                    description: "The target of the move",
                }
            ]
        },
        {
            type: "SUB_COMMAND",
            description: "Shows info about a move",
            name: "help",
            options: [
                {
                    name: "move",
                    type: "STRING",
                    required: true,
                    description: "The move to show info about",
                    choices: moves.map((el, k) => ({name: el.name, value: k}))
                },
            ]
        },
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
        }
    },
    async run(i) {
        if (!(i.channel instanceof TextChannel)) return await i.reply("What")
        var u = getUser(i.user)
        switch (i.options.getSubcommand()) {
            case "move": {
                if (!u.lobby?.battle) return await i.reply("You cannot choose outside of battle")
                var moveId = i.options.getString("move", true)
                var move = moves.get(moveId)
                if (!move) return await i.reply(`Invalid move`)
                var player = u.lobby.battle.players[i.options.getInteger("target", true)]
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
                await i.reply({
                    ephemeral: true,
                    content: "k"
                })
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
                        return Object.keys(boost).map(el => ({stat: el, boost: boost[el]})).filter(el => el.boost != 0)
                    }
                    var userStat = funi(move.userStat)
                    var targetStat = funi(move.targetStat)
                    var fields: EmbedFieldData[] = []
                    fields.push({
                        name: "General info",
                        value: `${desc}`
                    })
                    if (userStat.length) {
                        fields.push({
                            name: `User stat changes`,
                            value: `**Chance**: ${Math.floor(move.userStatChance * 100)}%\n` + userStat.map(el => {
                                return `**${getString("stat." + el.stat)}**: ${thing(el.boost)}`
                            }).join("\n")
                        })
                    }
                    if (targetStat.length) {
                        fields.push({
                            name: `Target stat changes`,
                            value: `**Chance**: ${Math.floor(move.targetStatChance * 100)}%\n` + targetStat.map(el => {
                                return `**${getString("stat." + el.stat)}**: ${thing(el.boost)}`
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
            }
        }
    }
}