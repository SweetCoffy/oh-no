import { Command } from "../command-loader.js"
export var command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "ping",
    description: "pingery",
    async run(i) {
        await i.reply(`pong`)
    }
}