import { writeSync, openSync, closeSync } from "fs"
import { Command } from "../command-loader"

export var command: Command = {
    name: "suggest",
    description: "get real",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: "title",
            type: ApplicationCommandOptionType.String,
            description: "your mother",
            required: true,
        },
        {
            name: "content",
            type: ApplicationCommandOptionType.String,
            description: "your mother",
            required: true,
        },
        {
            name: "type",
            type: ApplicationCommandOptionType.String,
            description: "your mother",
            required: true,
            choices: [
                {
                    name: "Addition/Removal",
                    value: "add/remove"
                },
            ]
        }
    ],
    async run(i) {
        await i.reply("your mother");
        var fd = openSync("thing.txt", "w");
        writeSync(fd, `${i.options.getString("type", true)} - ${i.user.username}: ${i.options.getString("title", true)}\n${i.options.getString("content", true)}\n\n`) 
        closeSync(fd);
    }
}