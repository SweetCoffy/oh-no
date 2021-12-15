import { Command, loadDir, addCommands } from "../command-loader.js"
import { settings } from "../util.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "reload",
    description: "Reload commands",
    async run(i) {
        if (i.user.id != settings.ownerID) return await i.reply("Only the bot owner can use this command")
        if (!i.guild) return await i.reply("not funny, didn't laugh")
        var cmds = await loadDir("commands")
        await addCommands(i.guild, cmds)
        await i.reply("epöc")
    }
}