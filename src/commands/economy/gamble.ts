import { ApplicationCommandOptionType, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../command-loader.js";
import { getRank, getUser } from "../../users.js";
import { money } from "../../number-format.js";

export let command: Command = {
    name: "gamble",
    description: "gamble or something idfk",
    options: [
        {
            type: ApplicationCommandOptionType.Integer,
            required: true,
            description: "amount of money to gamble",
            name: "money"
        }
    ],
    async run(i: ChatInputCommandInteraction) {
        let m = BigInt(i.options.getInteger("money", true))
        let u = getUser(i.user)
        if (getRank(i.user) < 10) return await i.reply(`You must be at least Rank 10 to gamble`)
        if (u.money.points < m) return await i.reply(`You can't gamble more money than you have!`)
        let req = 10000n + (u.multiplier - 1n) * 5000n
        if (m < req) return await i.reply(`You must bet at least ${money(req)}`)
        let chance = 0.4
        u.money.points -= m;
        if (Math.random() < chance) {
            u.money.points += m * 2n;
            await i.reply(`You got ${money(m * 2n)}!`)
        } else {
            await i.reply(`You lost ${money(m)}`)
        }
    }
}