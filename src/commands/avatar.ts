import { ApplicationCommandType, ApplicationCommandOptionType } from "discord.js"
import { Command } from "../command-loader.js"
export var command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "avatar",
    description: "when you",
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "asd",
            required: false,
        }
    ],
    async run(i) {
        var user = i.options.getUser("user") || i.user
        await i.reply({
            embeds: [
                {
                    title: `get real`,
                    author: {
                        name: user.username,
                        icon_url: user.displayAvatarURL({ size: 256 })
                    },
                    image: {
                        url: user.displayAvatarURL({ size: 4096 }),
                    }
                }
            ]
        })
    }
}