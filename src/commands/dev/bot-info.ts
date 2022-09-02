import { Command } from "../../command-loader";
import { uptime, arch, platform, version, release } from "os"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { timeFormat } from "../../util.js"

export var command: Command = {
    name: "bot-info",
    description: "a",
    type: "CHAT_INPUT",
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
                `Platform: ${platform()} ${release()}\n` + 
                `System uptime: ${timeFormat(uptime())}\n` +
                `Bot uptime: ${timeFormat(Math.floor((i.client.uptime||0) / 1000))}\n` + (gitinfo ? gitinfo : "")
            }]
        })
    }
}
