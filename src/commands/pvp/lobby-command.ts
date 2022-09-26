import { BattleLobby, createLobby, Difficulty, findValidLobby, lobbies } from '../../lobby.js';
import { Command } from '../../command-loader.js'
import { getUser, users } from '../../users.js';
import { ButtonInteraction, CommandInteraction, Message, MessageActionRow, MessageButton, MessageComponentInteraction, MessageSelectMenu, TextChannel } from 'discord.js';
import { BattleType, MaxTeams, MinTeams, Player, teamEmojis, teamNames } from '../../battle.js';
import { enemies } from '../../enemies.js';
import { getString } from '../../locale.js';
import { confirmation } from '../../util.js';
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
                    name: "name",
                    required: false,
                    type: "STRING",
                    description: "The name of the lobby"
                },
                {
                    name: "bot_count",
                    required: false,
                    type: "INTEGER",
                    description: "The amount of bots",
                },
                {
                    name: "level",
                    required: false,
                    type: "INTEGER",
                    description: "The level to set everyone to",
                },
                {
                    name: "battle_type",
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
                        },
                        {
                            name: "Team Match",
                            value: "team_match",
                        }
                    ]
                },
                {
                    name: "team_count",
                    required: false,
                    type: "INTEGER",
                    description: "The amount of teams for Team Match",
                },
                {
                    name: "difficulty",
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
                    name: "boss_type",
                    required: false,
                    type: "STRING",
                    description: "beuhg",
                    choices: enemies.filter(el => el.boss).map((el, k) => ({name: el.name, value: k}))
                },
                {
                    name: "flags",
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
                    name: 'id',
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
                        let team = undefined
                        lobby.join(i.user, { team }, i.channel || undefined)
                        if (lobby.type == "team_match") {
                            team = await teamPrompt(i)
                            await i.followUp({
                                content: `${i.user.username} has joined`,
                            })
                        } else await i.reply({
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
        async function teamPrompt(interaction: CommandInteraction | MessageComponentInteraction) {
            var r
            if (interaction.replied) {
                r = await interaction.followUp({
                    content: `Which team do you want to join?`,
                    components: [new MessageActionRow().addComponents(new MessageSelectMenu().setCustomId("team").addOptions(
                        { label: "Random", value: "random", default: false },
                        ...teamNames.map((v, i) => ({ label: `Team ${v}`, value: i.toString(), emoji: teamEmojis[i] }))
                    ))]
                }) as Message
            } else {
                r = await interaction.reply({
                    content: `Which team do you want to join?`,
                    fetchReply: true,
                    components: [new MessageActionRow().addComponents(new MessageSelectMenu().setCustomId("team").addOptions(
                        { label: "Random", value: "random", default: false },
                        ...teamNames.map((v, i) => ({ label: `Team ${v}`, value: i.toString(), emoji: teamEmojis[i] }))
                    ))]
                }) as Message
            }
            let team = undefined
            try {
                let select = await r.awaitMessageComponent({
                    componentType: "SELECT_MENU", filter: (int) => {
                        if (int.user.id != interaction.user.id) {
                            int.reply({ content: "This is not for you", ephemeral: true })
                            return false
                        }
                        return true
                    }, time: 60 * 1000
                })
                await select.deferUpdate()
                let v = select.values[0]
                if (v == "random") team = undefined
                else team = parseInt(v)
            } catch (_) { }
            finally {
                await r.edit("Team selected")
                return team
            }
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
                let lobby = lobbies.get(i.options.getString("id", true))
                if (!lobby) return await i.reply("uaishfuiersnvgeiurgrgerg")
                let team = i.options.getInteger("team") ?? undefined
                if (lobby.type == "team_match" && team == undefined) team = await teamPrompt(i)
                lobby.join(i.user, { team, nickname: (await i.guild?.members.fetch(i.user.id))?.nickname || undefined, enemyPreset: i.options.getString("enemy_preset") || undefined }, i.channel)
                await i.reply(`Joined the lobby`)
                break;
            }
            case "create": {
                let botCount = i.options.getInteger("bot_count", false) || 0
                let lobby = createLobby(i.user, i.options.getString("name", false) || undefined, 100000)
                let teamCount = i.options.getInteger("team_count", false) || 4
                if (teamCount < MinTeams) return await i.reply(`Too little teams (min: ${MinTeams})`)
                if (teamCount > MaxTeams) return await i.reply(`Too many teams (max: ${MaxTeams})`)
                lobby.level = i.options.getInteger("level", false) || 50
                lobby.botCount = botCount
                lobby.type = (i.options.getString("battle_type", false) || "ffa") as BattleType
                lobby.difficulty = (i.options.getString("difficulty", false) || "medium") as Difficulty
                lobby.bossType = i.options.getString("boss_type") || undefined
                lobby.flags = i.options.getString("flags") || ""
                lobby.teamCount = teamCount
                lobby.usersE[0].enemyPreset = i.options.getString("enemy_preset") || "default"
                lobby.usersE[0].nickname = (await i.guild?.members.fetch(i.user.id))?.nickname || undefined
                lobby.channels.push(i.channel)
                await lobbyInfo(lobby, i)
                if (lobby.type == "team_match") lobby.usersE[0].team = await teamPrompt(i)
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
                                return await i.channel.send(`${lobby.users.map(el => el.toString()).join(", ")} Pingery\n${winner} won`)
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
                        if (lobby.battle && !await confirmation(i, `If you leave a lobby that has already started, you will not be able to get back in. Are you sure you want to leave?`)) {
                            await i.followUp(`Cancelled`)
                            return
                        }
                        lobby.leave(i.user)
                        await i.reply("Left the lobby")
                    } else {
                        if (!await confirmation(i, `Leaving the lobby as the host will end it entirely. Are you sure you want to leave?`)) {
                            await i.followUp(`Cancelled`)
                            return
                        }
                        lobby.delete()
                        await i.followUp("Ended the lobby")
                    }
                } else return i.reply("You are not in a lobby")
            }
        }
    }
}