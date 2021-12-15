import { Command } from "../command-loader.js"
import { getUser } from "../users.js"
import { Message, MessageButton, MessageActionRow } from "discord.js"
import { getItem, shopItems, useItem } from "../items.js"
import { format, itemResponseReply } from "../util.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "item",
    description: "Do stuff with items",
    options: [
        {
            type: "SUB_COMMAND",
            name: "list",
            description: "Shows a list of the items you have",
        },
        {
            type: "SUB_COMMAND",
            name: "use",
            description: "Uses an item",
            options: [
                {
                    type: "STRING",
                    name: "item",
                    description: "The item to use",
                    required: true,
                },
                {
                    type: "INTEGER",
                    name: "amount",
                    description: "The amount of items to use",
                    required: false,
                },
            ]
        },
        {
            type: "SUB_COMMAND",
            name: "sell",
            description: "Sells an item",
            options: [
                {
                    type: "STRING",
                    name: "item",
                    description: "The item to sell",
                    required: true,
                },
                {
                    type: "INTEGER",
                    name: "amount",
                    description: "The amount of items to sell",
                    required: false,
                },
            ]
        },
    ],
    async run(i) {
        var u = getUser(i.user)
        switch (i.options.getSubcommand()) {
            case "list": {
                var page = 0
                var pageSize = 10
                var items = u.items
                var pageCount = Math.ceil(items.length / pageSize)
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
                                title: `Inventory`,
                                description: `Your money: ${format(getUser(i.user).money.points)}$\n${items.map(el => `${shopItems.get(el.item)?.toString(el.amount)}`).slice(page * pageSize, page * pageSize + pageSize).join("\n")}`
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
            case "use": {
                var item = i.options.getString("item", true)
                var amount = BigInt(i.options.getInteger("amount") || 0) || getItem(i.user, item)?.amount || 1n
                var res = useItem(i.user, item, amount)
                await itemResponseReply(res, i, item, amount)
                break;
            }
            case "sell": {
                var item = i.options.getString("item", true)
                var amount = BigInt(i.options.getInteger("amount") || 0) || getItem(i.user, item)?.amount || 1n
                var itemInfo = shopItems.get(item)
                var it = getItem(i.user, item)
                if (!it) return await i.reply("Bruh")
                if (it.amount < amount) return await i.reply("No")
                //asd asd
                if (itemInfo) {
                    var amt = itemInfo.cost/2n * amount
                    it.amount -= amt
                    getUser(i.user).money.points += amt
                    if (itemInfo.stock != Infinity) {
                        itemInfo.stock += Number(amount)
                    }
                    await i.reply(`Sold ${itemInfo.toString(amount)} for ${format(amt)}$`)
                } else await i.reply("What\n\nHow")
                break;
            }
        }
    }
}