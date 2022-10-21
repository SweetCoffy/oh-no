import { ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction } from "discord.js";
import { Command, commands } from "../../command-loader.js";
import { settings } from "../../util.js";

export let command: Command = {
    name: "deploy",
    dev: true,
    type: ApplicationCommandType.ChatInput,
    description: "Deploys commands except dev commands (dev only)",
    options: [
        {
            type: ApplicationCommandOptionType.Boolean,
            required: false,
            name: "no_guild",
            description: "a"
        }
    ],
    async run(i: ChatInputCommandInteraction) {
        if (i.user.id != settings.ownerID) return await i.reply("not funny")
        await i.deferReply()
        let cmds = await i.guild?.commands.fetch()
        if (!cmds) return
        let p = []
        for (let [k, v] of cmds) {
            if (v.applicationId == i.client.application?.id) {
                if (commands.get(v.name)?.dev) continue
                p.push(v.delete())
            }
        }
        if (i.options.getBoolean("no_guild")) {
            await Promise.all(p)
            return await i.editReply(`Removed guild commands`)
        }
        for (let [k, v] of commands) {
            if (v.dev) continue;
            if ("description" in v) {
                v.description = v.description.replace("(Test)", "")
            }
            p.push(i.client.application?.commands.create({...v}))
        }
        await Promise.all(p)
        return await i.editReply(`D o n e`)
    }
}