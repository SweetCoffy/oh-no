import { ApplicationCommandOptionType, ApplicationCommandType } from "discord.js"
import { Command } from "../../command-loader.js"
import { enemies } from "../../enemies.js"
import { bar } from "../../util.js"
ApplicationCommandOptionType.User
export var command: Command = {
    name: "enemy",
    description: "le bruhe",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            type: ApplicationCommandOptionType.String,
            required: false,
            name: "enemy",
            description: "a",
        }
    ],
    async run(i) {
        var e = enemies.get(i.options.getString("enemy") || "")
        if (e) {
            var max = Math.max(300, Math.max(...Object.values(e.stats)))
            await i.reply({
                embeds: [
                    {
                        title: e.name,
                        description: `${e.description || "N/A"}\n\nStats:\n${
                            Object.keys(e.stats)
                            .map(k => `\`${k.padEnd(6, " ")} ${e?.stats[k].toString().padStart(6, " ")} ${bar(e?.stats[k] as number, max, 20)}\``)
                            .join("\n")
                        }\n\`Total  ${Object.values(e?.stats).reduce((prev, cur) => prev + cur, 0).toString().padStart(6, " ")}\``
                    }
                ]
            })
        } else {
            await i.reply(`Enemy list: ${enemies.map((el, k) => `\`${k}\` ${el.name}`).join("\n")}`)
        }
    }
}