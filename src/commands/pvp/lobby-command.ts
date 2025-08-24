import { BattleLobby, createLobby, Difficulty, findValidLobby, lobbies } from '../../lobby.js';
import { Command } from '../../command-loader.js'
import { getUser, users } from '../../users.js';
import { ActionRowBuilder, APIActionRowComponent, ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, CommandInteraction, ComponentType, Message, MessageComponentInteraction, SelectMenuBuilder, StringSelectMenuBuilder, TextChannel } from 'discord.js';
import { BattleType, BattleTypeInfo, MaxTeams, MinTeams, Player, teamEmojis, teamNames } from '../../battle.js';
import { enemies } from '../../enemies.js';
import { getString } from '../../locale.js';
import { collectionAutocomplete, confirmation, dictAutocomplete } from '../../util.js';
function teamPromptComponent(lobbyId: string, teamCount: number, msg?: Message) {
    let cid = `lobby:join/${lobbyId}`
    if (msg) {
        cid += `/${msg.channel.id}/${msg.id}`
    }
    let selectMenu = new StringSelectMenuBuilder().setCustomId(cid)
    for (let i = 0; i < teamCount; i++) {
        selectMenu.addOptions({
            value: i.toString(),
            label: teamNames[i],
            emoji: teamEmojis[i],
        })
    }
    let actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
    return actionRow
}
function genLobbyInfo(lobby: BattleLobby) {
    return {
        embeds: [
            {
                title: `${lobby.name}`,
                description: `## ${BattleTypeInfo[lobby.type].name}\n` +
                    `ID: \`${lobby.id}\`\n` +
                    (lobby.isTeamMatch() ? `Teams: **${lobby.teamCount}**\n` : ``) +
                    `Bots: **${lobby.botCount}**\n` +
                    `Level: **${lobby.level}**\n` +
                    `Players: **${lobby.users.length}**\n` +
                    `${lobby.users.map(u => u.toString()).join("\n")}`
            }
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder({
                    label: "Join",
                    disabled: lobby.ready || lobby.users.length >= lobby.capacity,
                    style: ButtonStyle.Primary,
                    customId: `lobby:join/${lobby.id}`
                })
            )
        ],
        fetchReply: true,
    }
}
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
                    autocomplete: true,
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
                    autocomplete: true,
                    //choices: enemies.filter(el => el.boss).map((el, k) => ({ name: el.name, value: k }))
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
        }
    ],
    associatedCustomIds: ["lobby:"],
    async autocomplete(i) {
        let focused = i.options.getFocused(true)
        if (focused.name == "boss_type") {
            return await collectionAutocomplete(i, enemies)
        }
        if (focused.name == "battle_type") {
            return await dictAutocomplete(i, BattleTypeInfo)
        }
        await i.respond([])
    },
    async interaction(i) {
        if (i.isStringSelectMenu()) {
            if (i.customId.startsWith("lobby:join/")) {
                let splits = i.customId.split("/")
                let lobbyId = splits[1]
                let ogChId = splits[2]
                let ogMsgId = splits[3]
                let lobby = lobbies.get(lobbyId)
                if (!lobby) {
                    return await i.reply({ flags: ["Ephemeral"], content: "Unknown lobby." })
                }
                if (lobby.ready) {
                    return await i.reply({ flags: ["Ephemeral"], content: "The match already started." })
                }
                if (!lobby.isTeamMatch()) {
                    return await i.reply({ flags: ["Ephemeral"], content: "Non-Team game mode." })
                }
                let userI = lobby.users.findIndex(u => u.id == i.user.id)
                let team = parseInt(i.values[0])
                if (userI != -1) {
                    lobby.usersE[userI].team = team
                    return await i.update({ content: `Team switched to ${teamNames[team]}.`, components: [] })
                }
                try {
                    lobby.join(i.user, { team }, i.channel?.isTextBased() ? i.channel : undefined)
                    if (ogMsgId && ogChId) {
                        let ogCh = await i.client.channels.fetch(ogChId)
                        if (ogCh && ogCh.isTextBased()) {
                            let ogMsg = ogCh.messages.resolve(ogMsgId)
                            if (ogMsg) await ogMsg.edit(genLobbyInfo(lobby))
                        }
                    }
                    return await i.update({ content: `Joined.`, components: [] })
                } catch {
                    return await i.update({ content: `Join error.`, components: [] })
                }
            }
        }
        if (!i.isButton()) {
            return
        }
        if (i.customId.startsWith("lobby:join/")) {
            let splits = i.customId.split("/")
            let lobbyId = splits[1]
            let lobby = lobbies.get(lobbyId)
            if (!lobby) {
                return await i.reply({ flags: ["Ephemeral"], content: "Unknown lobby." })
            }
            if (lobby.ready) {
                return await i.reply({ flags: ["Ephemeral"], content: "The match already started." })
            }
            if (lobby.isTeamMatch()) {
                return await i.reply({ flags: ["Ephemeral"], components: [teamPromptComponent(lobby.id, lobby.teamCount, i.message)] })
            }
            try {
                lobby.join(i.user, {}, i.channel?.isTextBased() ? i.channel : undefined)
                await i.update(genLobbyInfo(lobby))
                return await i.reply({ flags: ["Ephemeral"], content: `Joined.`, components: [] })
            } catch {
                return await i.reply({ flags: ["Ephemeral"], content: `Join error.`, components: [] })
            }
        }
    },
    async run(i: ChatInputCommandInteraction) {
        if (!i.channel?.isTextBased()) return await i.reply("Wha")
        async function lobbyInfo(lobby: BattleLobby, i: CommandInteraction) {
            await i.reply(genLobbyInfo(lobby))
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
                if (lobby.isTeamMatch()) {
                    await i.followUp({ flags: ["Ephemeral"], components: [teamPromptComponent(lobby.id, lobby.teamCount)] })
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
                            await Promise.all(lastInfos.filter(v => v.deletable).map(v => v.delete()))
                            lastInfos = []
                            let settled = await Promise.allSettled(lobby.channels.filter(c => c.isSendable()).map(c => battle.infoMessage(c)))
                            for (let s of settled) {
                                if (s.status == "fulfilled") {
                                    lastInfos.push(s.value)
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
                } else return await i.reply("You are not in a lobby")
            }
            default: {
                return await i.reply("huh?")
            }
        }
    }
}