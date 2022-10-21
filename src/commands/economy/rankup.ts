import { ApplicationCommandType, ApplicationCommandOptionType, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../command-loader.js";
import { getRank, getUser } from "../../users.js";
import { money } from "../../util.js";

export let command: Command = {
    name: "rankup",
    type: ApplicationCommandType.ChatInput,
    description: "ae",
    options: [
        {
            name: "money",
            type: ApplicationCommandOptionType.Integer,
            description: "The amount of money to spend",
            required: true,
        }
    ],
    async run(i: ChatInputCommandInteraction) {
        let u = getUser(i.user)
        let cur = getRank(i.user)
        let next = cur + 1

        let cost = BigInt(i.options.getInteger("money", true))
        if (u.money.points < cost) return await i.reply(`Not enough money`)
        u.money.points -= cost;
        u.rank_xp += Number(cost)
        return await i.reply(`Rank ${cur} -> ${getRank(i.user)}, spent ${money(cost)}`)
    }
}