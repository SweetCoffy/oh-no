import { writeSync, openSync, closeSync } from "fs"
import { Command } from "../command-loader"

export var command: Command = {
    name: "suggest",
    description: "get real",
    type: "CHAT_INPUT",
    options: [
        {
            name: "title",
            type: "STRING",
            description: "your mother",
            required: true,
        },
        {
            name: "content",
            type: "STRING",
            description: "your mother",
            required: true,
        },
        {
            name: "type",
            type: "STRING",
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