import { ApplicationCommandType } from "discord.js";
import { Command } from "../../command-loader";
import { uptime, arch, platform, version, release } from "os"
import { readFile } from "fs/promises"
import { existsSync } from "fs"

export var command: Command = {
    name: "bot-info",
    description: "a",
    type: ApplicationCommandType.ChatInput,
    async run(i) {
        var gitinfo = ``
        if (existsSync(".git")) {
            var branch = await readFile(".git/HEAD", "utf8")
            var hash = await readFile(".git/" + branch.slice("ref: ".length, -1), "utf8")
            gitinfo += `Branch: ${branch.split("/").slice(-1)[0].slice(0, -1)} (${hash.slice(0, 7)})`
        }
        await i.reply({
            embeds: [{
                title: "Bot info",
                description:
                `Platform: ${arch()} ${platform()} (${version()})\n` + 
                `System uptime: ${Math.floor(uptime() / 60 / 60)} hours\n` +
                `Bot uptime: ${Math.floor((i.client.uptime||0) / 1000 / 60)} minutes\n` + (gitinfo ? gitinfo : "")
            }]
        })
    }
}