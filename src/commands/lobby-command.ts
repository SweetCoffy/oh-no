import { BattleLobby, createLobby, findValidLobby, lobbies } from '../lobby.js';
import { Command } from '../command-loader.js'
import { getUser, users } from '../users.js';
import { CommandInteraction, MessageActionRow, MessageButton, TextChannel } from 'discord.js';
import { Player } from '../battle.js';
export var command: Command = {
    name: "lobby",
    description: "ur mom",
    type: "CHAT_INPUT",
    options: [
        {
            type: "SUB_COMMAND",
            description: "Finds a valid lobby and shows info",
            name: "find",
            options: []
        },
        {
            type: "SUB_COMMAND",
            description: "Creates a lobby",
            name: "create",
            options: [
                {
                    name: "lobby_capacity",
                    required: true,
                    type: "INTEGER",
                    description: "The capacity",
                },
                {
                    name: "lobby_name",
                    required: false,
                    type: "STRING",
                    description: "The name of the lobby"
                },
                {
                    name: "lobby_bot_count",
                    required: false,
                    type: "INTEGER",
                    description: "The amount of bots",
                },
                {
                    name: "lobby_level",
                    required: false,
                    type: "INTEGER",
                    description: "The level to set everyone to",
                },
            ]
        },
        {
            type: "SUB_COMMAND",
            description: "Starts the battle in the current lobby",
            name: "start",
            options: []
        },
        {
            type: "SUB_COMMAND",
            description: "Shows a list of lobbies",
            name: "list",
            options: []
        },
        {
            type: "SUB_COMMAND",
            description: "Leaves the current lobby or ends it if you're the host",
            name: "leave",
            options: []
        },
        {
            type: "SUB_COMMAND",
            description: "Joins a lobby",
            name: "join",
            options: [
                {
                    name: 'lobby_id',
                    required: true,
                    type: "STRING",
                    description: "The ID of the lobby to join",
                }
            ]
        }
    ],
    async run(i) {
        if (!(i.channel instanceof TextChannel)) return await i.reply("big bruh")
        async function lobbyInfo(lobby: BattleLobby, i: CommandInteraction) {
            return await i.reply({
                embeds: [
                    {
                        title: `${lobby.name}`,
                        description: `ID: ${lobby.id}\nHas started: ${lobby.started ? "Yes" : "No"}\nPlayers: ${lobby.users.length}/${lobby.capacity}\nBot count: ${lobby.botCount}\nLevel: ${lobby.level}\nTotal score: ${lobby.battle?.totalScore ?? "N/A"}`
                    }
                ]
            })
        }
        switch (i.options.getSubcommand()) {
            case "list": {
                await i.reply({
                    embeds: [
                        {
                            title: `Lobby list`,
                            description: lobbies.map(el => `${el.name} (\`${el.id}\`)`).join("\n") || "empty af"
                        }
                    ]
                })
                break;
            }
            case "find": {
                let lobby = findValidLobby(i.user)
                if (lobby) {
                    await lobbyInfo(lobby, i)
                } else return await i.reply("Could't find a valid lobby, big brug")
                break;
            }
            case "join": {
                if (getUser(i.user).lobby) return await i.reply("eriughergieuhgr")
                let lobby = lobbies.get(i.options.getString("lobby_id", true))
                if (!lobby) return await i.reply("uaishfuiersnvgeiurgrgerg")
                lobby.join(i.user)
                await i.reply(`Joined the lobby`)
                break;
            }
            case "create": {
                var botCount = i.options.getInteger("lobby_bot_count", false) || 0
                let lobby = createLobby(i.user, i.options.getString("lobby_name", false) || undefined, i.options.getInteger("lobby_capacity", false) ?? 2)
                lobby.level = i.options.getInteger("lobby_level", false) || 1
                lobby.botCount = botCount
                await lobbyInfo(lobby, i)
                if (i.options.getBoolean("lobby_bot_join")) {
                    if (i.client.user) lobby.join(i.client.user)
                }
                break;
            }
            case "start": {
                let lobby = getUser(i.user)?.lobby
                if (lobby && !lobby.started) {
                    lobby.start()
                    await i.reply({
                        content: `${lobby.users.map(el => el.toString()).join(", ")} funni`,
                    })
                    let battle = lobby.battle
                    if (battle) {
                        var lastInfo = await battle.infoMessage(i.channel)
                        battle.on("newTurn", async() => {
                            if (!battle) return
                            if (!(i.channel instanceof TextChannel)) return
                            if (lastInfo.deletable) await lastInfo.delete()
                            lastInfo = await battle.infoMessage(i.channel)
                        }).on("end", async(winner?: Player) => {
                            if (!lobby) return
                            if (!battle) return
                            if (!(i.channel instanceof TextChannel)) return
                            await battle.infoMessage(i.channel)
                            await i.channel.send(`${lobby.users.map(el => el.toString()).join(", ")} Pingery\n${winner ? `${winner.name} Won` : `It was a tie`}`)
                        })
                    }
                } else return i.reply("bruv")
                break;
            }
            case "leave": {
                let lobby = getUser(i.user)?.lobby
                if (lobby) {
                    if (lobby.host.id != i.user.id) {
                        lobby.leave(i.user)
                        if (!lobby.battle) {
                            await i.reply("Left the lobby")
                        } else {
                            var lost = Math.floor(getUser(i.user).score * 0.075)
                            await i.reply(`Left the lobby while a battle was running, lost ${lost} score`)
                        }
                    } else {
                        lobby.delete()
                        await i.reply("Ended the lobby")
                    }
                } else return i.reply("bruh")
            }
        }
    }
}