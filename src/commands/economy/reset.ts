import { ApplicationCommandType } from "discord.js";
import { Command } from "../../command-loader.js";
import { data, users } from "../../users.js";
import { confirmation } from "../../util.js";

export var command: Command = {
    name: "reset",
    type: ApplicationCommandType.ChatInput,
    description: "Deletes your data",
    async run(i) {
        if (!await confirmation(i, `Are you sure you want to delete your user data? You will **NOT** be able to recover it.`)) {
            return await i.followUp(`Cancelled data deletion.`)
        }
        users.delete(i.user.id)
        delete data[i.user.id]
        await i.followUp("Your data has been deleted.")
    }
}