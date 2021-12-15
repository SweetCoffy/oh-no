import { Command } from "../command-loader.js"
import { getUser } from "../users.js"
import { format, rng } from "../util.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "work",
    description: "Work and earn money, money earned lowers the more often you use it",
    async run(i) {
        var base = 250 + Math.floor(Math.random() * 50)
        var t = Math.min((Date.now() - getUser(i.user).lastWork) / 1000, 60)
        base -= Math.floor((60 - t) / 60 * 300)
        var earned = BigInt(Math.floor(base)) * (1n + getUser(i.user).multiplier/8n*3n)
        getUser(i.user).money.points += earned
        getUser(i.user).lastWork = Date.now()
        if (earned < 0) {
            await i.reply(`You lost ${format(-earned)}$ <:troll:816067955305086986>`)
        } else {
            await i.reply(`You worked and earned ${format(earned)}$`)
        }
    }
}