import { ApplicationCommandType } from "discord.js"
import { Command } from "../../command-loader.js"
import { addItem, shopItems } from "../../items.js"
import { getRank, getUser } from "../../users.js"
import { money } from "../../number-format.js"
export let command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "work",
    description: "Work and earn money, money earned lowers the more often you use it",
    async run(i) {
        let real = Math.ceil(50 * (1 + (getRank(i.user) * (1 + ((getRank(i.user) - 1) * 0.03)))))
        let base = real/2 + Math.floor(Math.random() * real)
        let t = Math.min((Date.now() - getUser(i.user).lastWork) / 1000, 60*5)
        base -= Math.floor((60*5 - t) / 60*5 * base*1.1)
        let earned = BigInt(Math.floor(base)) * (1n + getUser(i.user).multiplier/8n*3n)
        getUser(i.user).money.points += earned
        getUser(i.user).lastWork = Date.now()
        if (earned < 0) {
            await i.reply(`You lost ${money(-earned)} <:troll:816067955305086986>`)
        } else {
            await i.reply(`You worked and earned ${money(earned)}`)
        }
        if (Math.random() < 1/16) {
            addItem(i.user, {
                item: "sus_bell",
                amount: 1n,
            })
            await i.followUp(`You found a ${shopItems.get("sus_bell")?.toString()}!`)
        }
    }
}