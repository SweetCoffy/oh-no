import { BattleLobby, createLobby, Difficulty, findValidLobby, lobbies } from '../../lobby.js';
import { Command } from '../../command-loader.js'
import { getUser, users } from '../../users.js';
import { CommandInteraction, Message, MessageActionRow, MessageButton, TextChannel } from 'discord.js';
import { BattleType, Player } from '../../battle.js';
import { enemies } from '../../enemies.js';
import { getString } from '../../locale.js';
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
                {
                    name: "lobby_battle_type",
                    required: false,
                    type: "STRING",
                    description: "The type of battle",
                    choices: [
                        {
                            name: "Free For All",
                            value: "ffa",
                        },
                        {
                            name: "PvE",
                            value: "pve",
                        },
                        {
                            name: 'Vs. Boss',
                            value: "boss",
                        }
                    ]
                },
                {
                    name: "lobby_difficulty",
                    required: false,
                    type: "STRING",
                    description: "The difficulty level, only has an effect in Vs. Boss",
                    choices: [
                        {
                            name: "Easy",
                            value: "easy",
                        },
                        {
                            name: "Normal",
                            value: "medium",
                        },
                        {
                            name: "Hard",
                            value: "hard",
                        },
                        {
                            name: "Hell",
                            value: "hell",
                        },
                    ]
                },
                {
                    name: "lobby_boss_type",
                    required: false,
                    type: "STRING",
                    description: "beuhg",
                    choices: enemies.filter(el => el.boss).map((el, k) => ({name: el.name, value: k}))
                },
                {
                    name: "lobby_flags",
                    required: false,
                    type: "STRING",
                    description: "ha ha flags"
                },
                {
                    name: 'enemy_preset',
                    required: false,
                    type: "STRING",
                    description: "The enemy preset to use, only has an effect in lobbies with the E flag",
                    choices: enemies.map((v, k) => ({name: v.name, value: k}))
                }
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
                },
                {
                    name: 'enemy_preset',
                    required: false,
                    type: "STRING",
                    description: "The enemy preset to use, only has an effect in lobbies with the E flag",
                    choices: enemies.map((v, k) => ({name: v.name, value: k}))
                },
                {
                    name: 'team',
                    required: false,
                    type: "INTEGER",
                    description: "The team to join as, only has an effect in lobbies with the T flag",
                    choices: [
                        {
                            name: "Player",
                            value: 0
                        },
                        {
                            name: "Enemy",
                            value: 1
                        }
                    ]
                }
            ]
        },
    ],
    async run(i) {
        if (!i.channel?.isText()) return await i.reply("Wha")
        async function lobbyInfo(lobby: BattleLobby, i: CommandInteraction) {
            var reply = await i.reply({
                embeds: [
                    {
                        title: `${lobby.name}`,
                        description: `ID: ${lobby.id}\nHas started: ${lobby.started ? "Yes" : "No"}\nPlayers: ${lobby.users.length}/${lobby.capacity}\nBot count: ${lobby.botCount}\nLevel: ${lobby.level}\nType: ${getString(`battle.${lobby.type}`)}\nFlags: ${lobby.flagsString}`
                    }
                ],
                components: [
                    new MessageActionRow().addComponents(new MessageButton({ label: "JOIN", disabled: lobby.ready || lobby.users.length >= lobby.capacity, style: "SUCCESS", customId: "join" }))
                ],
                fetchReply: true,
            }) as Message
            reply.createMessageComponentCollector({time: 1000 * 60 * 5}).on("collect", async(i) => {
                if (i.customId == "join") {
                    try {
                        lobby.join(i.user, undefined, i.channel || undefined)
                        await i.reply({
                            content: `${i.user.username} has joined`,
                        })
                    } catch {
                        await i.reply({
                            content: "Could not join the lobby",
                            ephemeral: true,
                        })
                    }
                }
            }).on("end", () => {
                reply.edit({components: []})
            })
        }
        switch (i.options.getSubcommand()) {
            case "list": {
                await i.reply({
                    embeds: [
                        {
                            title: `Lobby list`,
                            description: lobbies.map(el => `${el.name} (\`${el.id}\`)`).join("\n") || "Empty"
                        }
                    ]
                })
                break;
            }
            case "find": {
                let lobby = findValidLobby(i.user)
                if (lobby) {
                    await lobbyInfo(lobby, i)
                } else return await i.reply("Couldn't find a valid lobby")
                break;
            }
            case "join": {
                if (getUser(i.user).lobby) return await i.reply("eriughergieuhgr")
                let lobby = lobbies.get(i.options.getString("lobby_id", true))
                if (!lobby) return await i.reply("uaishfuiersnvgeiurgrgerg")
                lobby.join(i.user, { enemyPreset: i.options.getString("enemy_preset") || undefined, team: i.options.getInteger("team") || 0 }, i.channel)
                await i.reply(`Joined the lobby`)
                break;
            }
            case "create": {
                var botCount = i.options.getInteger("lobby_bot_count", false) || 0
                let lobby = createLobby(i.user, i.options.getString("lobby_name", false) || undefined, i.options.getInteger("lobby_capacity", false) ?? 2)
                lobby.level = i.options.getInteger("lobby_level", false) || 1
                lobby.botCount = botCount
                lobby.type = (i.options.getString("lobby_battle_type", false) || "ffa") as BattleType
                lobby.difficulty = (i.options.getString("lobby_difficulty", false) || "medium") as Difficulty
                lobby.bossType = i.options.getString("lobby_boss_type") || undefined
                lobby.flags = i.options.getString("lobby_flags") || ""
                lobby.usersE[0].enemyPreset = i.options.getString("enemy_preset") || "default"
                lobby.channels.push(i.channel)
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
                        var lastInfos: Message[] = []
                        for (var c of lobby.channels) {
                            lastInfos.push(await battle.infoMessage(c))
                        }
                        battle.checkActions();
                        battle.on("newTurn", async() => {
                            if (!battle) return
                            if (!lobby) return
                            if (!(i.channel instanceof TextChannel)) return
                            for (var lastInfo of lastInfos) {
                                if (lastInfo.deletable) await lastInfo.delete()
                            }
                            lastInfos = []
                            for (var c of lobby.channels) {
                                lastInfos.push(await battle.infoMessage(c))
                            }
                            setTimeout(() => {
                                battle?.checkActions();
                            }, 5000)
                        }).on("end", async(winner?: Player) => {
                            if (!lobby) return
                            if (!battle) return
                            if (!(i.channel instanceof TextChannel)) return
                            await battle.infoMessage(i.channel)
                            if (typeof winner == "string") {
                                return await i.channel.send(`${lobby.users.map(el => el.toString()).join(", ")} Pingery\nThe ${winner} won`)
                            }
                            await i.channel.send(`${lobby.users.map(el => el.toString()).join(", ")} Pingery\n${winner ? `${winner.name} Won` : `It was a tie`}`)
                        })
                    }
                } else {
                    if (!lobby) await i.reply("You are not in a lobby")
                    if (lobby?.start) await i.reply("The lobby already started")
                }
                break;
            }
            case "leave": {
                let lobby = getUser(i.user)?.lobby
                if (lobby) {
                    if (lobby.host.id != i.user.id) {
                        lobby.leave(i.user)
                        await i.reply("Left the lobby")
                    } else {
                        lobby.delete()
                        await i.reply("Ended the lobby")
                    }
                } else return i.reply("You are not in a lobby")
            }
        }
    }
}