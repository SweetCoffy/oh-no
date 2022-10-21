import { ApplicationCommandType, ApplicationCommandOptionType } from "discord.js";
import { Command } from "../../command-loader.js";
import { getRank, getUser } from "../../users.js";
import { money } from "../../util.js";

export var command: Command = {
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
    async run(i) {
        var u = getUser(i.user)
        var cur = getRank(i.user)
        var next = cur + 1

        var cost = BigInt(i.options.get("money", true).value as number)
        if (u.money.points < cost) return await i.reply(`Not enough money`)
        u.money.points -= cost;
        u.rank_xp += Number(cost)
        return await i.reply(`Rank ${cur} -> ${getRank(i.user)}, spent ${money(cost)}`)
    }
}