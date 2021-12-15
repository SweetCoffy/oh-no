import { Command } from "../command-loader.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "ping",
    description: "pingery",
    async run(i) {
        await i.reply(`pong`)
    }
}