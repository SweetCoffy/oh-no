import { Command } from "../../command-loader.js"
import { getLevelUpXP, getUser, level, getRank } from "../../users.js"
import { bar, format, settings, money } from "../../util.js"
export var command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "profile",
    description: "bru",
    options: [
        {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "asd",
            required: false,
        }
    ],
    async run(i) {
        var user = i.options.getUser("user") || i.user
        var u = getUser(user)
        var val = (BigInt(u.banks) * (u.multiplier/4n))*15n
        var b = val / 60n
        var funi = val % 60n
        await i.reply({
            embeds: [
                {
                    title: `${user.username}'s Profile`,
                    color: user.hexAccentColor || 0,
                    description: 
`
**Economy**
> Money: ${money(u.money.points)}
> Multiplier: ${format(u.multiplier)}
> Banks: ${format(u.banks)} (${money(b + funi)}/m)

**Grindy shit**
> Rank: ${getRank(user)} (${money(BigInt(getUser(user).rank_xp))} spent)
> 
> **Hunt XP**
> Level: ${u.level}
> XP: \`[${bar(u.xp, getLevelUpXP(user), 10)}]\` ${u.xp}/${getLevelUpXP(user)}
> 
> **Message XP**
> Level ${level(user)}
> \`[${bar(u.msgLvl_xp - (level(user))**3, (level(user))**3 - (level(user)-2)**3, 10)}]\`
> XP: ${u.msgLvl_xp}
> Messages: ${u.msgLvl_messages}
${settings.noSave ? (settings.experimental ? `**• NOTE**: Bot is running in experimental mode, no changes will be saved` : `**• NOTE**: Bot is running in no save mode, no changes will be saved`) : ``}
`
                }
            ]
        })
    }
}