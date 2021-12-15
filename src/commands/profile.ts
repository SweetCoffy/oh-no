import { Command } from "../command-loader.js"
import { getUser } from "../users.js"
import { format } from "../util.js"
export var command: Command = {
    type: "USER",
    name: "Profile",
    async run(i) {
        var user = await i.client.users.fetch(i.targetId)
        var u = getUser(user)
        var val = (BigInt(u.banks) * (u.multiplier))*60n
        var b = val / 60n
        var funi = ((val % 60n) * 10n) / 6n
        await i.reply({
            ephemeral: true,
            embeds: [
                {
                    title: `${user.username}'s Profile`,
                    description: 
`
Money: ${format(u.money.points)}$
Multiplier: ${format(u.multiplier)}
Banks: ${u.banks} (${b}.${funi}$/m)
`
                }
            ]
        })
    }
}