import { ApplicationCommandType, ApplicationCommandOptionType, codeBlock } from "discord.js"
import { Command } from "../../command-loader.js"
import { getLevelUpXP, getUser, level, getRank, UPDATE_TIME_INC } from "../../users.js"
import { bar, settings } from "../../util.js"
import { ffrac, fnum, format, money } from "../../number-format.js"
import { HP_PER_INC, huntData } from "../../save_special.js"
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
        let hunt = huntData.get(u)
        let val = (BigInt(u.banks) * (u.multiplier/4n))*15n
        let b = val / 60n
        let funi = val % 60n
        let hpRecoveryMessage
        if (hunt.hpPercent < 1) {
            let remPercent = 1 - hunt.hpPercent
            let remIncs = Math.ceil(remPercent / HP_PER_INC)
            let remTime = Math.ceil(remIncs * UPDATE_TIME_INC / 1000)
            hpRecoveryMessage = `Full recovery in: ${fnum(remTime)} seconds`
        }
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
Money: ${money(u.money.points)}
Multiplier: ${format(u.multiplier)}
Banks: ${format(u.banks)} (${money(b + funi)}/m)
Rank: ${getRank(user)} (${money(BigInt(getUser(user).rank_xp))} spent)

**Hunt**
Level ${u.level}\n` +
codeBlock("ansi", 
    `XP ${bar(u.xp, getLevelUpXP(user), 20)}| ${fnum(u.xp)}/${fnum(getLevelUpXP(user))}\n` + 
    `HP ${bar(Math.floor(hunt.hpPercent*100), 100, 20)}| ${ffrac(hunt.hpPercent)}\n` + 
    (hpRecoveryMessage ? hpRecoveryMessage + "\n" : "")
)
                }
            ]
        })
    }
}