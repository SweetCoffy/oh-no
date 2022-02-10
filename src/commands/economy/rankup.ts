import { Command } from "../../command-loader.js";
import { getRank, getUser } from "../../users.js";
import { money } from "../../util.js";

export var command: Command = {
    name: "rankup",
    type: "CHAT_INPUT",
    description: "ae",
    options: [
        {
            name: "money",
            type: "INTEGER",
            description: "The amount of money to spend",
            required: true,
        }
    ],
    async run(i) {
        var u = getUser(i.user)
        var cur = getRank(i.user)
        var next = cur + 1

        var cost = BigInt(i.options.getInteger("money", true))
        if (u.money.points < cost) return await i.reply(`Not enough money`)
        u.money.points -= cost;
        u.rank_xp += Number(cost)
        return await i.reply(`Rank ${cur} -> ${getRank(i.user)}, spent ${money(cost)}`)
    }
}