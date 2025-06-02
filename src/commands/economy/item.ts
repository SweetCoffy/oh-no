import { Command } from "../../command-loader.js"
import { getUser } from "../../users.js"
import { Message, ApplicationCommandOptionType, ApplicationCommandType, ComponentType, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, APIActionRowComponent, ButtonStyle } from "discord.js"
import { addItem, getItem, recipes, shopItems, stackString, useItem } from "../../items.js"
import { experimental, itemResponseReply, lexer } from "../../util.js"
import { format, money } from "../../number-format.js"
export let command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "item",
    description: "Do stuff with items",
    options: [
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "list",
            description: "Shows a list of the items you have",
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "use",
            description: "Uses an item",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "item",
                    description: "The item to use",
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    description: "The amount of items to use",
                    required: false,
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "args",
                    description: "what",
                    required: false,
                }
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "sell",
            description: "Sells an item",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "item",
                    description: "The item to sell",
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    description: "The amount of items to sell",
                    required: false,
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "smelt",
            description: "Smelts an item",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "item",
                    description: "The item to smelt",
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    description: "The amount of items to smelt",
                    required: false,
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "burn",
            description: "Burns an item",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "item",
                    description: "The item to burn",
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    description: "The amount of items to burn",
                    required: false,
                },
            ]
        },
        {
            type: ApplicationCommandOptionType.Subcommand,
            name: "craft",
            description: "Crafts an item",
            options: [
                {
                    type: ApplicationCommandOptionType.String,
                    name: "recipe",
                    description: "The recipe to use",
                    required: true,
                    autocomplete: true,
                },
                {
                    type: ApplicationCommandOptionType.Integer,
                    name: "amount",
                    description: "The amount of items to craft",
                    required: false,
                },
            ]
        },
    ],
    async autocomplete(i) {
        let focused = i.options.getFocused(true)
        let inv = getUser(i.user).items;
        let query = focused.value.toString().toLowerCase();
        if (focused.name == "args") {
            let it = getItem(i.user, i.options.getString("item", true))
            if (it) {
                let a = shopItems.get(it.item)?.autocomplete
                if (a) return await a(i.user, it, i)
            } else await i.respond([])
        } else if (focused.name == "item") {
            let r = inv.map((el, i) => ({...el, i})).filter(el => el.amount > 0 && (el.item.includes(query) || shopItems.get(el.item)?.name.includes(query))).slice(0, 25)
            return await i.respond(r.map(el => ({name: stackString(el, false), value: el.i + ""})))
        } else if (focused.name == "recipe") {
            let r = recipes.filter(el => el.name.toLowerCase().includes(query) || el.output.item.toLowerCase().includes(query))
            return await i.respond(r.map((el, k) => ({name: el.name, value: k})).slice(0, 25))
        } else await i.respond([])
    },
    async run(i: ChatInputCommandInteraction) {
        let u = getUser(i.user)
        switch (i.options.getSubcommand()) {
            case "list": {
                let page = 0
                let pageSize = 10
                let items = u.items
                let pageCount = Math.ceil(items.length / pageSize)
                let components: APIActionRowComponent<any>[] = [new ActionRowBuilder({
                    components: [
                        new ButtonBuilder({ emoji: "◀️", style: ButtonStyle.Primary, customId: "prev" }),
                        new ButtonBuilder({ emoji: "▶️", style: ButtonStyle.Primary, customId: "next" }),
                    ]
                }).toJSON()]
                async function update(msg: Message) {
                    await msg.edit({
                        embeds: [
                            {
                                title: `Inventory`,
                                description: `Your money: ${format(u.money.points)}$\n${u.fuel > 0 ? `Fuel: 🔥 ${format(u.fuel)}` : ``}\n${items.map((el, i) => ({...el, i})).filter(el => el.amount > 0).map(el => `\`#${el.i}\` ${stackString(el)}`).slice(page * pageSize, page * pageSize + pageSize).join("\n")}`
                            }
                        ],
                        components
                    })
                }
                let msg = await i.reply({
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
            case "use": {
                let item = i.options.getString("item", true)
                let amount = BigInt(i.options.getInteger("amount", false) || 0) || getItem(i.user, item)?.amount || 1n
                let args: string[] = lexer(i.options.get("args")?.value as string || "")
                let resGen = useItem(i.user, item, amount, ...args)
                for await (let res of resGen) {
                    await itemResponseReply(res, i)
                }
                break;
            }
            case "sell": {
                let item = i.options.getString("item", true)
                let amount = BigInt(i.options.getInteger("amount", false) || 0) || getItem(i.user, item)?.amount || 1n
                let it = getItem(i.user, item)
                let itemInfo = shopItems.get(it?.item as string)
                if (!it) return await i.reply("Bruh")
                if (it.amount < amount) return await i.reply("No")
                if (itemInfo) {
                    let amt = itemInfo.cost/2n * amount
                    it.amount -= amount
                    getUser(i.user).money.points += amt
                    if (itemInfo.stock != Infinity) {
                        itemInfo.stock += Number(amount)
                    }
                    await i.reply(`Sold ${itemInfo.toString(amount)} for ${money(amt)}`)
                } else await i.reply("What\n\nHow")
                break;
            }
            case "smelt": {
                let item = i.options.getString("item", true)
                let amount = BigInt(i.options.getInteger("amount", false) || 0) || getItem(i.user, item)?.amount || 1n
                let it = getItem(i.user, item)
                let itemInfo = shopItems.get(it?.item as string)
                if (!it) return await i.reply("Bruh")
                if (it.amount < amount) return await i.reply("No")
                if (itemInfo) {
                    if (!itemInfo.smeltInto) return await i.reply(`This item cannot be smelted`)
                    let fuelNeeded = amount * itemInfo.fuelNeeded
                    if (u.fuel < fuelNeeded) return await i.reply(`You don't have enough fuel to smelt this item`)
                    it.amount -= amount
                    getUser(i.user).fuel -= fuelNeeded
                    addItem(i.user, {
                        item: itemInfo.smeltInto,
                        amount: amount,
                    })
                    let newItem = shopItems.get(itemInfo.smeltInto)
                    await i.reply(`Smelted ${itemInfo.toString(amount)} into ${newItem?.toString(amount)}`)
                } else await i.reply("What\n\nHow")
                break;
            }
            case "burn": {
                let item = i.options.getString("item", true)
                let amount = BigInt(i.options.getInteger("amount", false) || 0) || getItem(i.user, item)?.amount || 1n
                let it = getItem(i.user, item)
                let itemInfo = shopItems.get(it?.item as string)
                if (!it) return await i.reply("Bruh")
                if (it.amount < amount) return await i.reply("No")
                if (itemInfo) {
                    let fuel = itemInfo.fuelPower * amount
                    it.amount -= amount
                    u.fuel += fuel
                    await i.reply(`Burnt ${itemInfo.toString(amount)}${(fuel > 0) ? `, got +${format(fuel)} fuel` : ""}`)
                } else await i.reply("What\n\nHow")
                break;
            }
            case "craft": {
                let recipe = i.options.getString("recipe", true)
                let r = recipes.get(recipe)
                if (!r) return await i.reply(`invalid recipe`)
                let amount = BigInt(i.options.getInteger("amount", false) || 0) || r.canCraft(i.user);
                if (amount > r.canCraft(i.user)) return await i.reply(`bru`);
                for (let it of r.input) {
                    let stack = getItem(i.user, it.item)
                    if (!stack) return await i.reply(`what`)
                    stack.amount -= it.amount * amount;
                }
                addItem(i.user, {item: r.output.item, amount: r.output.amount * amount})
                await i.reply(`Crafted ${stackString({item: r.output.item, amount: r.output.amount * amount})}`)
            }
        }
    }
}