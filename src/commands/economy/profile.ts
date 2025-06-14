import { ApplicationCommandType, ApplicationCommandOptionType } from "discord.js"
import { Command } from "../../command-loader.js"
import { getLevelUpXP, getUser, level, getRank } from "../../users.js"
import { bar, settings } from "../../util.js"
import { fnum, format, money } from "../../number-format.js"
export let command: Command = {
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
        let user = i.options.get("user")?.user || i.user
        let u = getUser(user)
        let val = (BigInt(u.banks) * (u.multiplier/4n))*15n
        let b = val / 60n
        let funi = val % 60n
        await i.reply({
            embeds: [
                {
                    title: `${user.username}'s Profile`,
                    color: settings.accentColor,
                    description: 
`
**Account**
> Created: <t:${Math.floor(user.createdTimestamp / 1000)}:R>

**Economy**
> Money: ${money(u.money.points)}
> Multiplier: ${format(u.multiplier)}
> Banks: ${format(u.banks)} (${money(b + funi)}/m)

**Grindy shit**
> Rank: ${getRank(user)} (${money(BigInt(getUser(user).rank_xp))} spent)
> 
> **Hunt XP**
> Level: ${u.level}
> XP: \`${bar(u.xp, getLevelUpXP(user), 16)}\` ${fnum(u.xp)}/${fnum(getLevelUpXP(user))}
> 
> **Message XP**
> Level ${level(user)}
> \`${bar(u.msgLvl_xp - (level(user)) ** 3, (level(user)) ** 3 - (level(user) - 2) ** 3, 16)}\`
> XP: ${fnum(u.msgLvl_xp)}
> Messages: ${fnum(u.msgLvl_messages)}
${settings.noSave ? (settings.experimental ? `**• NOTE**: Bot is running in experimental mode, no changes will be saved` : `**• NOTE**: Bot is running in no save mode, no changes will be saved`) : ``}
`
                }
            ]
        })
    }
}