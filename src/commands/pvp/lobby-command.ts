import { BattleLobby, createLobby, Difficulty, findValidLobby, lobbies } from '../../lobby.js';
import { Command } from '../../command-loader.js'
import { getUser, users } from '../../users.js';
import { ActionRowBuilder, APIActionRowComponent, ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, CommandInteraction, ComponentType, Message, MessageComponentInteraction, SelectMenuBuilder, TextChannel } from 'discord.js';
import { BattleType, BattleTypeInfo, MaxTeams, MinTeams, Player, teamEmojis, teamNames } from '../../battle.js';
import { enemies } from '../../enemies.js';
import { getString } from '../../locale.js';
import { confirmation } from '../../util.js';
export let command: Command = {
    name: "lobby",
    description: "ur mom",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Finds a valid lobby and shows info",
            name: "find",
            options: []
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Creates a lobby",
            name: "create",
            options: [
                {
                    name: "name",
                    required: false,
                    type: ApplicationCommandOptionType.String,
                    description: "The name of the lobby"
                },
                {
                    name: "bot_count",
                    required: false,
                    type: ApplicationCommandOptionType.Integer,
                    description: "The amount of bots",
                },
                {
                    name: "level",
                    required: false,
                    type: ApplicationCommandOptionType.Integer,
                    description: "The level to set everyone to",
                },
                {
                    name: "battle_type",
                    required: false,
                    type: ApplicationCommandOptionType.String,
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
                        },
                        {
                            name: "Slap Fight",
                            value: "slap_fight",
                        },
                        {
                            name: "Team Slap Fight",
                            value: "team_slap_fight",
                        }
                    ]
                },
                {
                    name: "team_count",
                    required: false,
                    type: ApplicationCommandOptionType.Integer,
                    description: "The amount of teams for team-based modes",
                },
                {
                    name: "difficulty",
                    required: false,
                    type: ApplicationCommandOptionType.String,
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
                    type: ApplicationCommandOptionType.String,
                    description: "beuhg",
                    choices: enemies.filter(el => el.boss).map((el, k) => ({ name: el.name, value: k }))
                },
                {
                    name: "flags",
                    required: false,
                    type: ApplicationCommandOptionType.String,
                    description: "ha ha flags"
                },
                {
                    name: 'enemy_preset',
                    required: false,
                    type: ApplicationCommandOptionType.String,
                    description: "The enemy preset to use, only has an effect in lobbies with the E flag",
                    choices: enemies.map((v, k) => ({ name: v.name, value: k }))
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Starts the battle in the current lobby",
            name: "start",
            options: []
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Shows a list of lobbies",
            name: "list",
            options: []
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Leaves the current lobby or ends it if you're the host",
            name: "leave",
            options: []
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            description: "Joins a lobby",
            name: "join",
            options: [
                {
                    name: 'id',
                    required: true,
                    type: ApplicationCommandOptionType.String,
                    description: "The ID of the lobby to join",
                },
                {
                    name: 'enemy_preset',
                    required: false,
                    type: ApplicationCommandOptionType.String,
                    description: "The enemy preset to use, only has an effect in lobbies with the E flag",
                    choices: enemies.map((v, k) => ({ name: v.name, value: k }))
                },
                {
                    name: 'team',
                    required: false,
                    type: ApplicationCommandOptionType.Integer,
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
    async run(i: ChatInputCommandInteraction) {
        if (!i.channel?.isTextBased()) return await i.reply("Wha")
        async function lobbyInfo(lobby: BattleLobby, i: CommandInteraction) {
            let reply = await i.reply({
                embeds: [
                    {
                        title: `${lobby.name}`,
                        description: `< **${BattleTypeInfo[lobby.type].name.toUpperCase()}** >\nID: ${lobby.id}\nHas started: ${lobby.started ? "Yes" : "No"}\nPlayers: ${lobby.users.length}\nBot count: ${lobby.botCount}\nLevel: ${lobby.level}\nFlags: ${lobby.flagsString}`
                    }
                ],
                components: [
                    new ActionRowBuilder().addComponents(new ButtonBuilder({ label: "JOIN", disabled: lobby.ready || lobby.users.length >= lobby.capacity, style: ButtonStyle.Success, customId: "join" })).toJSON() as APIActionRowComponent<any>
                ],
                fetchReply: true,
            }) as Message
            reply.createMessageComponentCollector({ time: 1000 * 60 * 5 }).on("collect", async (i) => {
                if (i.customId == "join") {
                    try {
                        let team = undefined
                        if (lobby.isTeamMatch()) {
                            team = await teamPrompt(i, lobby.teamCount)
                            lobby.join(i.user, { team }, i.channel || undefined)
                            await i.followUp({
                                content: `${i.user.username} has joined`,
                            })
                        } else {
                            lobby.join(i.user, { team }, i.channel || undefined)
                            await i.reply({
                                content: `${i.user.username} has joined`,
                            })
                        }
                    } catch {
                        await i.reply({
                            content: "Could not join the lobby",
                            ephemeral: true,
                        })
                    }
                }
            }).on("end", () => {
                reply.edit({ components: [] })
            })
        }
        async function teamPrompt(interaction: CommandInteraction | MessageComponentInteraction, teamCount: number) {
            let r
            if (interaction.replied) {
                r = await interaction.followUp({
                    content: `Which team do you want to join?`,
                    components: [new ActionRowBuilder().addComponents(new SelectMenuBuilder().setCustomId("team").addOptions(
                        { label: "Random", value: "random", default: false },
                        ...teamNames.slice(0, teamCount).map((v, i) => ({ label: `Team ${v}`, value: i.toString(), emoji: teamEmojis[i] }))
                    )).toJSON()] as APIActionRowComponent<any>[]
                }) as Message
            } else {
                r = await interaction.reply({
                    content: `Which team do you want to join?`,
                    fetchReply: true,
                    components: [new ActionRowBuilder().addComponents(new SelectMenuBuilder().setCustomId("team").addOptions(
                        { label: "Random", value: "random", default: false },
                        ...teamNames.slice(0, teamCount).map((v, i) => ({ label: `Team ${v}`, value: i.toString(), emoji: teamEmojis[i] }))
                    )).toJSON()] as APIActionRowComponent<any>[]
                }) as Message
            }
            let team = undefined
            try {
                let select = await r.awaitMessageComponent({
                    componentType: ComponentType.SelectMenu, filter: (int) => {
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
                await r.edit({ content: "Team selected", components: [] })
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
                let team = i.options.getInteger("team", false) ?? undefined
                if (lobby.isTeamMatch() && team == undefined) team = await teamPrompt(i, lobby.teamCount)
                lobby.join(i.user, { team, nickname: (await i.guild?.members.fetch(i.user.id))?.nickname || undefined, enemyPreset: i.options.getString("enemy_preset", false) || undefined }, i.channel)
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
                lobby.bossType = i.options.getString("boss_type", false) || undefined
                lobby.flags = i.options.getString("flags", false) || ""
                lobby.teamCount = teamCount
                lobby.usersE[0].enemyPreset = i.options.getString("enemy_preset", false) || "default"
                lobby.usersE[0].nickname = (await i.guild?.members.fetch(i.user.id))?.nickname || undefined
                lobby.channels.push(i.channel)
                await lobbyInfo(lobby, i)
                if (lobby.isTeamMatch()) lobby.usersE[0].team = await teamPrompt(i, lobby.teamCount)
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
                        let lastInfos: Message[] = []
                        for (let c of lobby.channels) {
                            if (c.isSendable()) {
                                lastInfos.push(await battle.infoMessage(c))
                            }
                        }
                        battle.checkActions();
                        battle.on("newTurn", async () => {
                            if (!battle) return
                            if (!lobby) return
                            if (!(i.channel instanceof TextChannel)) return
                            for (let lastInfo of lastInfos) {
                                if (lastInfo.deletable) await lastInfo.delete()
                            }
                            lastInfos = []
                            for (let c of lobby.channels) {
                                if (c.isSendable()) {
                                    lastInfos.push(await battle.infoMessage(c))
                                }
                            }
                            setTimeout(() => {
                                battle?.checkActions();
                            }, 5000)
                        }).on("end", async (winner?: Player) => {
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