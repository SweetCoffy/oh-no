import { Command } from "../command-loader.js"
import fetch from "node-fetch"
import { ActionRow, ButtonComponent, MessageEmbedOptions, Message } from "discord.js"
const BASE_URL = "http://api.urbandictionary.com/v0/define"
interface UDDefinitionData {
    permalink: string,

    word: string,
    definition: string,
    example: string,
    author: string,

    thumbs_up: number,
    thumbs_down: number,

    sound_urls: string[],
    defid: number,
    current_vote: string,
    written_on: string,
}
export var command: Command = {
    name: "urban",
    type: ApplicationCommandType.ChatInput,
    description: "Looks up something in urban dictionary",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "term",
            description: "brub",
            required: true,
        }
    ],
    async run(i) {
        var h = await fetch(`${BASE_URL}?term=${encodeURIComponent(i.options.getString("term", true))}`)
        if (!h.ok) return await i.reply("epic error moment")
        var data: UDDefinitionData[] = JSON.parse(await h.text()).list
        var cur = 0
        var embeds: MessageEmbedOptions[] = []
        function uFormat(str: string) {
            var regex = /\[([^\[\]]+)\]/g
            return str.replace(regex, function(substr, s: string) {
                return `[${s}](https://www.urbandictionary.com/define.php?term=${encodeURIComponent(s)})`
            })
        }
        function funi() {
            var d = data[cur]
            embeds = [
                {
                    title: `${d.word}`
                }
            ]
            var s = split(uFormat(d.definition))
            for (var i = 0; i < s.length; i++) {
                if (!embeds[i]) {
                    embeds[i] = {
                        description: ""
                    }
                }
                embeds[i].description = s[i]
            }
            if (d.example) {
                var s = split(uFormat(d.example))
                for (var i = 0; i < s.length; i++) {
                    if (i == 0) {
                        embeds.push({
                            title: "Example",
                            description: `${s[i]}`
                        })
                    } else {
                        embeds.push({
                            description: `${s[i]}`
                        })
                    }
                }
            }
            function split(str: string) {
                var parts = str.split(/[ ]/g).map(el => el + " ")
                var a = []
                var acc = ""
                for (var p of parts) {
                    if (acc.length + p.length >= 2000) {
                        a.push(acc)
                        acc = ""
                    }
                    acc += p
                }
                if (acc) a.push(acc)
                return a
            }
            var last = embeds[embeds.length - 1]
            last.footer = { text: `Definition ${cur + 1} of ${data.length} | 👍 ${d.thumbs_up} | 👎 ${d.thumbs_down}` }
            last.timestamp = new Date(d.written_on)
            return embeds
        }
        await i.reply({
            ephemeral: true,
            content: "b"
        })
        var msgs: Message[] = []
        async function update() {
            for (var m of msgs) {
                await m.delete()
            }
            msgs = []
            var e = funi()
            for (var j = 0; j < e.length; j += 2) {
                var embeds = e.slice(j, j + 2)
                var components: ActionRow[] = []
                if (j >= e.length - 2) {
                    components = [
                        new ActionRow({
                            components: [
                                new ButtonComponent({ emoji: "◀️", style: ButtonStyle.Primary, customId: "prev" }),
                                new ButtonComponent({ emoji: "▶️", style: ButtonStyle.Primary, customId: "next" }),
                            ]
                        })
                    ]
                }
                msgs.push(await i.followUp({embeds: [...embeds], components}) as Message)
            }
            try {
                var btn = await msgs[msgs.length - 1].awaitMessageComponent({
                    time: 1000 * 60,
                    componentType: ComponentType.Button,
                    filter(i) {
                        return true
                    }
                })
                await btn.deferUpdate()
                if (btn.customId == "next") cur++
                if (btn.customId == "prev") cur--
                if (cur < 0) cur = data.length - 1
                if (cur >= data.length) cur = 0
                await update()
            } catch (er) {
            }
        }
        await update()
    }
}