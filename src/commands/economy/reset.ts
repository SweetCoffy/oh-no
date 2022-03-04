import { ApplicationCommandType } from "discord.js";
import { Command } from "../../command-loader.js";
import { data, users } from "../../users.js";

export var command: Command = {
    name: "reset",
    type: ApplicationCommandType.ChatInput,
    description: "Deletes your data",
    async run(i) {
        users.delete(i.user.id)
        delete data[i.user.id]
        await i.reply("Your data has been erased")
    }
}