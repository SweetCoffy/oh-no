import { ActionRowBuilder, APIActionRowComponent, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, Message, SelectMenuBuilder, StringSelectMenuBuilder } from "discord.js";
import { Command } from "../../command-loader.js";
import { moves } from "../../moves.js";
import { getUser } from "../../users.js";
import { settings } from "../../util.js";

export let command: Command = {
    name: "moveset",
    description: "A",
    type: ApplicationCommandType.ChatInput,
    associatedCustomIds: ["moveset:selector"],
    async interaction(i) {
        console.log(i)
        if (i.customId != "moveset:selector") {
            return
        }
        if (!i.isStringSelectMenu()) {
            return
        }
        let moveset = i.values
        getUser(i.user).moveset = moveset
        await i.reply({ content: moveset.join(", ") })
    },
    async run(i: ChatInputCommandInteraction) {
        await i.reply({
            content: "Choose your moveset",
            components: [
                new ActionRowBuilder ({
                    components: [
                        new StringSelectMenuBuilder ({
                            maxValues: settings.maxMoves,
                            minValues: settings.maxMoves,
                            customId: "moveset:selector",
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
            ] as APIActionRowComponent<any>[],
        })
    }
}