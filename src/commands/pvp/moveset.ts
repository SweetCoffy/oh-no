import { ActionRowBuilder, APIActionRowComponent, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ContainerBuilder, Message, SelectMenuBuilder, StringSelectMenuBuilder, TextDisplayBuilder, User } from "discord.js";
import { Command } from "../../command-loader.js";
import { moves } from "../../moves.js";
import { getUser, UserInfo } from "../../users.js";
import { settings } from "../../util.js";
function getMpLeft(moveset: string[], enhance: number[]) {
    let remMp = (settings.maxMoves - moveset.length) + settings.leftoverMp
    for (let l of enhance) {
        remMp -= l
    }
    return remMp
}
function mpAllocateComponent(user: User) {
    let u = getUser(user)
    let remMp = getMpLeft(u.moveset, u.movesetEnhance)
    let root = new ContainerBuilder()
    root.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Remaining: **${remMp}**✦`))
    let moveInfos = u.moveset.map(id => moves.get(id)!)
    moveInfos.forEach((v, mi) => {
        let curEnhance = u.movesetEnhance[mi]
        if (v.maxEnhance == 1) {
            root.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${v.name}**\n-# This move cannot be enhanced.`))
            return
        }
        root.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${v.name}**\n-# ${"✦".repeat(curEnhance + 1)}`))
        let actionRow = new ActionRowBuilder<ButtonBuilder>()
        for (let i = 1; i <= v.maxEnhance; i++) {
            let button = new ButtonBuilder().setLabel(`${i}✦`).setCustomId(`moveset:mp/${mi}/${i}`)
            let budgetDelta = (i - 1) - curEnhance
            button.setDisabled((remMp - budgetDelta) < 0)
            button.setEmoji("⚫")
            button.setStyle(ButtonStyle.Secondary)
            if ((i - 1) == curEnhance) {
                button.setStyle(ButtonStyle.Primary)
                button.setEmoji("🔘")
            }
            actionRow.addComponents(button)
        }
        root.addActionRowComponents(actionRow)
    })
    return root
}
export let command: Command = {
    name: "moveset",
    description: "A",
    type: ApplicationCommandType.ChatInput,
    associatedCustomIds: ["moveset:"],
    async interaction(i) {
        if (i.customId.startsWith("moveset:mp/")) {
            let splits = i.customId.split("/")
            let midx = parseInt(splits[1])
            let mpamt = parseInt(splits[2]) - 1
            let u = getUser(i.user)
            if (midx >= u.moveset.length) {
                return await i.reply({ flags: ["Ephemeral"], content: "huh?" })
            }
            let prevamt = u.movesetEnhance[midx]
            let eDelta = mpamt - prevamt
            let curLeft = getMpLeft(u.moveset, u.movesetEnhance)
            if ((curLeft - eDelta) < 0) {
                return await i.reply({ flags: ["Ephemeral"], content: "Allocation exceeds your budget (you should never see this message)" })
            }
            u.movesetEnhance[midx] = mpamt
            return await i.update({ components: [mpAllocateComponent(i.user)] })
        }
        if (i.customId == "moveset:budget") {
            await i.reply({ flags: ["IsComponentsV2", "Ephemeral"], components: [mpAllocateComponent(i.user)] })
            return
        }
        if (i.customId != "moveset:selector") {
            return
        }
        if (!i.isStringSelectMenu()) {
            return
        }
        let moveset = i.values
        let u = getUser(i.user)
        u.moveset = moveset
        u.movesetEnhance = moveset.map(_ => 0)
        let remMp = settings.maxMoves - moveset.length
        if (remMp <= 0) {
            return await i.reply({ content: `Zero ✦ remaining, no moves may be enhanced.`, flags: ["Ephemeral"] })
        }
        await i.reply({ flags: ["IsComponentsV2", "Ephemeral"], components: [mpAllocateComponent(i.user)] })
    },
    async run(i: ChatInputCommandInteraction) {
        await i.reply({
            content: "Choose your moveset",
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>({
                    components: [
                        new StringSelectMenuBuilder ({
                            maxValues: settings.maxMoves,
                            minValues: 1,
                            customId: "moveset:selector",
                            options: moves.filter(el => el.selectable).map((v, k) => {
                                return {
                                    value: k,
                                    label: v.name,
                                    default: getUser(i.user).moveset.includes(k),
                                    description: `${k}`
                                }
                            })
                        }),
                    ]
                }),
                new ActionRowBuilder<ButtonBuilder>()
                .addComponents(new ButtonBuilder().setLabel("View Enhancement Levels").setStyle(ButtonStyle.Secondary).setCustomId("moveset:budget"))
            ],
        })
    }
}