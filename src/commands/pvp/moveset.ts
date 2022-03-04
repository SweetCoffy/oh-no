import { Message, ActionRow, ButtonComponent, MessageSelectMenu } from "discord.js";
import { Command } from "../../command-loader.js";
import { moves } from "../../moves.js";
import { getUser } from "../../users.js";

export var command: Command = {
    name: "moveset",
    description: "A",
    type: ApplicationCommandType.ChatInput,
    async run(i) {
        var msg = await i.reply({
            content: "Choose your moveset",
            components: [
                new ActionRow({
                    components: [
                        new MessageSelectMenu({
                            maxValues: 4,
                            minValues: 4,
                            customId: "moveset",
                            options: moves.filter(el => el.selectable).map((v, k) => {
                                return {
                                    value: k,
                                    label: v.name,
                                    default: getUser(i.user).moveset.includes(k),
                                    description: `PWR ${v.power || "-"} | ACC ${v.accuracy || "-"} | ${v.category}`
                                }
                            })
                        }),
                    ]
                }),
                new ActionRow({
                    components: [
                        new ButtonComponent({
                            label: "Confirm",
                            style: "SUCCESS",
                            customId: "yes",
                        }),
                        new ButtonComponent({
                            label: "Cancel",
                            style: "DANGER",
                            customId: "no",
                        }),
                    ]
                })
            ],
            fetchReply: true
        }) as Message<boolean>
        var moveset = getUser(i.user).moveset
        var col = msg.createMessageComponentCollector({filter: (interaction) => {
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
                    content: `${moveset.join(", ")}`,
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