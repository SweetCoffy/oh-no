import { Message, ActionRow, ButtonComponent, ApplicationCommandOptionType, ApplicationCommandType, ButtonStyle, ComponentType } from "discord.js"
import { Command } from "../../command-loader.js"
import { shopItems, addItem, useItem, shops, Shop } from "../../items.js"
import { getUser } from "../../users.js"
import { format, itemResponseReply } from "../../util.js"
export var command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "shop",
    description: "Shop stuff",
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "list",
            description: 'Shows a list of the items in the shop',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
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
            type: ApplicationCommandOptionType.Subcommand,
            name: "buy",
            description: 'Buys an item from the shop',
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "item",
                    description: "The item to buy",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    description: "The amount of items to buy",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.Boolean,
                    name: "auto_use",
                    description: "Whether or not to automatically use the items bought",
                    required: false
                },
                {
                    type: ApplicationCommandOptionType.String,
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
                var components: ActionRow[] = [new ActionRow({
                    components: [
                        //@ts-ignore
                        { emoji: "◀️", style: ButtonStyle.Primary, customId: "prev", type: ComponentType.Button },
                        //@ts-ignore
                        { emoji: "▶️", style: ButtonStyle.Primary, customId: "next", type: ComponentType.Button },
                    ]
                })]
                async function update(msg: Message) {
                    await msg.edit({
                        embeds: [
                            {
                                title: `${shop.name}`,
                                description: `Your money: ${shop.moneyIcon} ${format(shop.getMoney(i.user))}\n${shop.items.sort((a, b) => Number(b.cost - a.cost)).map(el => `${shopItems.get(el.id)?.toString()} - ${shop.moneyIcon} ${format(el.cost)}`).slice(page * pageSize, page * pageSize + pageSize).join("\n")}`,
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
                    componentType: ComponentType.Button,
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
                    let res = shop.buyItem(i.user, item, amount)
                    await itemResponseReply(res, i)
                    if (autouse) {
                        let resGen = useItem(i.user, item, amount)
                        for await (let res of resGen) {
                            await itemResponseReply(res, i)
                        }
                    }
                } else await i.reply("Unknown item")
                break;
            }
        }
    }
}