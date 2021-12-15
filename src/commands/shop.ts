import { Message, MessageActionRow, MessageButton } from "discord.js"
import { Command } from "../command-loader.js"
import { shopItems, addItem, useItem } from "../items.js"
import { getUser } from "../users.js"
import { format, itemResponseReply } from "../util.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "shop",
    description: "Shop stuff",
    options: [
        {
            type: "SUB_COMMAND",
            name: "list",
            description: 'Shows a list of the items in the shop'
        },
        {
            type: "SUB_COMMAND",
            name: "buy",
            description: 'Buys an item from the shop',
            options: [
                {
                    type: "STRING",
                    name: "item",
                    description: "The item to buy",
                    required: true
                },
                {
                    type: "INTEGER",
                    name: "amount",
                    description: "The amount of items to buy",
                    required: false
                },
                {
                    type: "BOOLEAN",
                    name: "auto_use",
                    description: "Whether or not to automatically use the items bought",
                    required: false
                }
            ]
        },
    ],
    async run(i) {
        switch (i.options.getSubcommand()) {
            case "list": {
                var page = 0
                var pageSize = 10
                var pageCount = Math.ceil(shopItems.size / pageSize)
                var components: MessageActionRow[] = [new MessageActionRow({
                    components: [
                        new MessageButton({ emoji: "◀️", style: "PRIMARY", customId: "prev" }),
                        new MessageButton({ emoji: "▶️", style: "PRIMARY", customId: "next" }),
                    ]
                })]
                async function update(msg: Message) {
                    await msg.edit({
                        embeds: [
                            {
                                title: `Shop`,
                                description: `Your money: ${format(getUser(i.user).money.points)}$\n${shopItems.map(el => `${el.toString()} - ${format(el.cost)}$`).slice(page * pageSize, page * pageSize + pageSize).join("\n")}`
                            }
                        ],
                        components
                    })
                }
                var msg = await i.reply({
                    fetchReply: true,
                    embeds: [
                        {
                            description: "...",
                        }
                    ],
                    
                }) as Message
                msg.createMessageComponentCollector({
                    componentType: "BUTTON",
                    time: 1000 * 60,
                    filter: (el) => {
                        if (el.user.id != i.user.id) {
                            el.reply({
                                ephemeral: true,
                                content: "This is not for you"
                            })
                            return false
                        }
                        return true
                    }
                }).on("collect", el => {
                    if (el.customId == "prev") page--
                    if (el.customId == "next") page++
                    if (page < 0) page = pageCount - 1
                    if (page >= pageCount) page = 0
                    el.deferUpdate()
                    update(msg)
                }).on("end", () => {
                    msg.edit({
                        embeds: msg.embeds,
                        components: []
                    })
                })
                //@ts-ignore
                await update(msg)

                break;
            }
            case "buy": {
                var u = getUser(i.user)
                var item = i.options.getString("item", true)
                var itemInfo = shopItems.get(item)
                var amount = BigInt(i.options.getInteger("amount", false) || 0) || u.money.points / (itemInfo?.cost || 1n) || 1n
                var autouse = i.options.getBoolean("auto_use")
                if (itemInfo) {
                    if (itemInfo.stock <= 0) return await i.reply(`There is no items left in stock!`)
                    if (amount > itemInfo.stock) amount = BigInt(itemInfo.stock)
                    var cost = itemInfo.cost * BigInt(amount)
                    if (cost > u.money.points) return await i.reply(`Can't afford item (${format(cost)}$)`)
                    u.money.points -= cost
                    addItem(i.user, { item: itemInfo.id, amount: amount })
                    await i.reply(`Bought ${itemInfo.toString(amount)} for ${format(cost)}$`)
                    if (autouse) {
                        var res = useItem(i.user, item, amount)
                        await itemResponseReply(res, i, item, amount)
                    }
                } else await i.reply("Unknown item")
                break;
            }
        }
    }
}