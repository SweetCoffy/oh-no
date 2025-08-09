import { ActionRowBuilder, APIActionRowComponent, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Message, SelectMenuBuilder } from "discord.js";
import { Command } from "../../command-loader.js";
import { moves } from "../../moves.js";
import { getUser } from "../../users.js";
import { settings } from "../../util.js";

export let command: Command = {
    name: "moveset",
    description: "A",
    type: ApplicationCommandType.ChatInput,
    async run(i: ChatInputCommandInteraction) {
        let msg = await i.reply({
            content: "Choose your moveset",
            components: [
                new ActionRowBuilder ({
                    components: [
                        new SelectMenuBuilder ({
                            maxValues: settings.maxMoves,
                            minValues: settings.maxMoves,
                            customId: "moveset",
                            options: moves.filter(el => el.selectable).map((v, k) => {
                                return {
                                    value: k,
                                    label: v.name,
                                    default: getUser(i.user).moveset.includes(k),
                                    description: `${v.description || "N/A"}`.slice(0, 100)
                                }
                            })
                        }),
                    ]
                }).toJSON(),
                new ActionRowBuilder ({
                    components: [
                        new ButtonBuilder ({
                            label: "CONFIRM",
                            style: ButtonStyle.Success,
                            customId: "yes",
                        }),
                        new ButtonBuilder ({
                            label: "CANCEL",
                            style: ButtonStyle.Danger,
                            customId: "no",
                        }),
                    ]
                }).toJSON()
            ] as APIActionRowComponent<any>[],
            fetchReply: true
        }) as Message<boolean>
        let moveset = getUser(i.user).moveset
        let col = msg.createMessageComponentCollector({filter: (interaction) => {
            if (interaction.user.id != i.user.id) {
                interaction.reply({
                    ephemeral: true,
                    content: "no"
                })
                return false
            }
            return true
        }, time: 2 * 60 * 1000}).on("collect", async (interaction) => {
            if (interaction.customId == "moveset" && interaction.isSelectMenu()) {
                moveset = interaction.values
                await interaction.deferUpdate();
            }
            if (interaction.customId == "yes") {
                await i.editReply({
                    content: `${moveset.map(v => moves.get(v)?.name).join(", ")}`,
                    components: []
                })
                getUser(i.user).moveset = moveset;
            } else if (interaction.customId == "no") {
                if (!col.checkEnd()) col.stop()
            }
        }).on("end", async() => {
            await msg.delete()
        })
    }
}