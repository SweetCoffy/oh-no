import { ActionRowBuilder, APIActionRowComponent, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ContainerBuilder, Message, SelectMenuBuilder, StringSelectMenuBuilder, TextDisplayBuilder, User } from "discord.js";
import { Command } from "../../command-loader.js";
import { moves } from "../../moves.js";
import { getUser } from "../../users.js";
import { settings } from "../../util.js";
import { dispDelta } from "../../number-format.js";
import { getAvailableContent, getBaseMp } from "../../unlocking.js";
function getMpLeft(moveset: string[], enhance: number[], base: number) {
    let remMp = base - moveset.length
    for (let l of enhance) {
        remMp -= l
    }
    return remMp
}
function mpAllocateComponent(user: User) {
    let u = getUser(user)
    let baseMp = getBaseMp(u)
    let remMp = getMpLeft(u.moveset, u.movesetEnhance, baseMp)
    let root = new ContainerBuilder()
    root.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Remaining: **${remMp}**/${baseMp - u.moveset.length}✦`))
    let moveInfos = u.moveset.map(id => moves.get(id)!)
    moveInfos.forEach((v, mi) => {
        let curEnhance = u.movesetEnhance[mi]
        if (v.maxEnhance == 1) {
            root.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${v.name}**\n-# This move cannot be enhanced.`))
            return
        }
        root.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${v.name}**\n-# ${"✦".repeat(curEnhance + 1)}`))
        let actionRow = new ActionRowBuilder<ButtonBuilder>()
        let actionRows: ActionRowBuilder<ButtonBuilder>[] = []
        for (let i = 1; i <= v.maxEnhance; i++) {
            let button = new ButtonBuilder().setLabel(`${i}✦`).setCustomId(`moveset:mp/${mi}/${i}`)
            let budgetDelta = (i - 1) - curEnhance
            button.setDisabled((remMp - budgetDelta) < 0)
            button.setEmoji("⚫")
            if (budgetDelta != 0) {
                button.setLabel(`${dispDelta(budgetDelta, false)}✦`)
            }
            button.setStyle(ButtonStyle.Secondary)
            if ((i - 1) == curEnhance) {
                button.setStyle(ButtonStyle.Primary)
                button.setEmoji("🔘")
            }
            actionRow.addComponents(button)
            if (actionRow.components.length >= 5) {
                actionRows.push(actionRow)
                actionRow = new ActionRowBuilder<ButtonBuilder>()
            }
        }
        if (actionRow.components.length > 0) {
            actionRows.push(actionRow)
        }
        root.addActionRowComponents(actionRows)
    })
    return root
}
export let command: Command = {
    name: "moveset",
    description: "A",
    type: ApplicationCommandType.ChatInput,
    associatedCustomIds: ["moveset:"],
    async interaction(i) {
        let u = getUser(i.user)
        let baseMp = getBaseMp(u)
        if (i.customId.startsWith("moveset:mp/")) {
            let splits = i.customId.split("/")
            let midx = parseInt(splits[1])
            let mpamt = parseInt(splits[2]) - 1
            let remMp = getMpLeft(u.moveset, u.movesetEnhance, baseMp)
            if (midx >= u.moveset.length) {
                return await i.reply({ flags: ["Ephemeral"], content: "huh?" })
            }
            let info = moves.get(u.moveset[midx])!
            let prevamt = u.movesetEnhance[midx]
            let eDelta = mpamt - prevamt
            let curLeft = remMp
            if ((curLeft - eDelta) < 0) {
                return await i.reply({ flags: ["Ephemeral"], content: "Allocation exceeds your budget (you should never see this message)" })
            }
            if (mpamt > info.maxEnhance - 1) {
                return await i.reply({ flags: ["Ephemeral"], content: "No." })
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
        u.moveset = moveset
        u.movesetEnhance = moveset.map(_ => 0)
        let remMp = getMpLeft(u.moveset, u.movesetEnhance, baseMp)
        if (remMp <= 0) {
            return await i.reply({ content: `Zero ✦ remaining, no moves may be enhanced.`, flags: ["Ephemeral"] })
        }
        await i.reply({ flags: ["IsComponentsV2", "Ephemeral"], components: [mpAllocateComponent(i.user)] })
    },
    async run(i: ChatInputCommandInteraction) {
        let u = getUser(i.user)
        let baseMp = getBaseMp(u)
        let maxMoves = Math.max(Math.min(settings.maxMoves, baseMp), 1)
        let unlocks = getAvailableContent(u)
        let moveset = u.moveset.slice(0, maxMoves)
        let usableMoves = moves.filter(m => m.selectable)
        let unlockedMoves = usableMoves.filter((_, k) => unlocks.moves.has(k))
        await i.reply({
            content: `Select your moves.\n` + 
            `Limit: **${maxMoves}**✦\n` + 
            `🔓 **${unlockedMoves.size}**/${usableMoves.size}`,
            flags: ["Ephemeral"],
            components: [
                new ActionRowBuilder<StringSelectMenuBuilder>({
                    components: [
                        new StringSelectMenuBuilder ({
                            maxValues: maxMoves,
                            minValues: 1,
                            customId: "moveset:selector",
                            options: moves
                            .filter((el, k) => el.selectable && unlocks.moves.has(k))
                            .map((v, k) => {

                                return {
                                    value: k,
                                    label: v.name,
                                    default: moveset.includes(k),
                                    description: `${k}`,
                                    //disabled: ""
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