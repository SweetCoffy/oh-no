import { Message, MessageActionRow, MessageButton } from "discord.js"
import { Command } from "../../command-loader.js"
import { shopItems, addItem, useItem, shops, Shop } from "../../items.js"
import { getUser } from "../../users.js"
import { format, itemResponseReply } from "../../util.js"
export var command: Command = {
    type: "CHAT_INPUT",
    name: "shop",
    description: "Shop stuff",
    options: [
        {
            type: "SUB_COMMAND",
            name: "list",
            description: 'Shows a list of the items in the shop',
            options: [
                {
                    type: "STRING",
                    name: "shop",
                    description: "haha funni shop",
                    choices: shops.map((el, k) => ({
                        name: el.name,
                        value: k,
                    }))
                }
            ]
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
                },
                {
                    type: "STRING",
                    name: "shop",
                    description: "haha funni shop",
                    choices: shops.map((el, k) => ({
                        name: el.name,
                        value: k,
                    }))
                }
            ]
        },
    ],
    async run(i) {
        var findItem = i.options.getString("item")
        var autoDetect = shops.findKey(el => el.items.some(el => el.id == findItem))
        //@ts-ignore
        var shop: Shop = shops.get(i.options.getString("shop") || autoDetect || getUser(i.user).lastShop)
        if (!shop) {
            
            return
        }
        getUser(i.user).lastShop = i.options.getString("shop") || "main"
        switch (i.options.getSubcommand()) {
            case "list": {
                var page = 0
                var pageSize = 10
                var pageCount = Math.ceil(shop.items.length / pageSize)
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
                                title: `${shop.name}`,
                                description: `Your money: ${shop.moneyIcon} ${format(shop.getMoney(i.user))}\n${shop.items.map(el => `${shopItems.get(el.id)?.toString()} - ${shop.moneyIcon} ${format(el.cost)}`).slice(page * pageSize, page * pageSize + pageSize).join("\n")}`,
                                footer: { text: `Page ${page + 1}/${pageCount}` }
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
                var itm = shop.getItem(item)
                var itemInfo = shopItems.get(item)
                var amount = BigInt(i.options.getInteger("amount", false) || 0) || (shop.getMoney(i.user) / (itm?.cost || 1n)) || 1n
                var autouse = i.options.getBoolean("auto_use")
                if (itemInfo) {
                    var res = shop.buyItem(i.user, item, amount)
                    await itemResponseReply(res, i)
                    if (autouse) {
                        var res = useItem(i.user, item, amount)
                        await itemResponseReply(res, i)
                    }
                } else await i.reply("Unknown item")
                break;
            }
        }
    }
}