import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, codeBlock } from "discord.js";
import { Command } from "../command-loader";
import { search, wikiEntries } from "../bot_wiki";

export let command: Command = {
    name: "wiki",
    options: [{
        name: "term",
        type: ApplicationCommandOptionType.String,
        autocomplete: true,
        required: true,
        description: "term to look up"
    }],
    type: ApplicationCommandType.ChatInput,
    description: "looks up something",
    async autocomplete(i) {
        let query = i.options.getFocused(true).value
        let results = search(query)
        await i.respond(results.slice(0, 20).map(k => ({
            name: k,
            value: k
        })))
    },
    async run(i: ChatInputCommandInteraction) {
        let entry = wikiEntries.get(i.options.getString("term", true))
        if (!entry) return await i.reply({ flags: ["Ephemeral"], content: "Not found" })
        await i.reply({
            embeds: [
                {
                    title: entry.title,
                    description: codeBlock("ansi", entry.content)
                }]
        })
    }
}