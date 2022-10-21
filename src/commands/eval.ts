import { Command, loadDir, addCommands } from "../command-loader.js"
import { settings } from "../util.js"
import { inspect } from "util"
import { Worker } from "worker_threads" 
import { users } from "../users.js"
import { loaded } from "../content-loader.js"
import { VM } from "vm2"

import * as content_loader from "../content-loader.js"
import * as command_loader from "../command-loader.js"
import * as battle from "../battle.js"
import * as lobby from "../lobby.js"
import * as users_ from "../users.js"
import * as util from "../util.js"
import * as fs from "fs"
import * as discord from "discord.js"
import * as items from "../items.js"
import { shopItems } from "../items.js"
import { ApplicationCommandType, ApplicationCommandOptionType } from "discord.js"

export var command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "eval",
    description: "Runs JavaScript code. Some features are restricted to the bot owner.",
    dev: true,
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "code",
            required: true,
            description: "a"
        }
    ],
    async run(i) {
        var str = ""
        var data: any = undefined
        if (i.user.id == settings.ownerID) {
            var context = {
                console,
                interaction: i,
                process,
                get author() {
                    return users_.getUser(i.user);
                },
                shopItems,
                content_loader,
                command_loader,
                battle,
                lobby,
                users: users_,
                util,
                fs,
                discord,
                items,
            }
            var vm = new VM({sandbox: context, timeout: 5000})
            let out = vm.run(i.options.get("code", true).value as string)
            var outstr = out + ""
            if (typeof out == "object") {
                outstr = inspect(out, true, undefined, true)
            }
            await i.reply(`\`\`\`${typeof out == "object" ? "ansi" : "js"}\n${outstr || "empty"}\n\`\`\``)
            if (str) {
                await i.followUp(`\`\`\`js\n${str || "empty"}\n\`\`\``)
            }
            return
        }
        await i.deferReply()
        

        var w = new Worker("./build/eval-worker.js", 
        { workerData: {code: i.options.get("code", true).value as string, userId: i.user.id, dev: i.user.id == settings.ownerID, userData: data, loaded: loaded},
        resourceLimits: {maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 8} })
        
        let out = ""
        var exited = false
        w.on("message", (v) => {
            if (v.type == "return") {
                out = v.data + ""
            }
            if (v.type == "patch-user") {
                for (var id in v.data) {
                    var u = users.get(id)
                    for (var k in v.data[id]) {
                        //@ts-ignore
                        u[k] = v.data[id][k]
                    }
                }
            }
        })
        w.stdout.on('data', (chunk) => {
            str += chunk.toString()
        })
        w.on("exit", async () => {
            if (exited) return
            exited = true
            await i.editReply(`\`\`\`js\n${out || "empty"}\n\`\`\``)
            if (str) {
                await i.followUp(`\`\`\`js\n${str || "empty"}\n\`\`\``)
            }
        })
        w.on("error", (err) => {
            console.error(err)
            i.editReply(`${err}`)
            exited = true
        })
        setTimeout(() => {
            if (!exited) {
                w.terminate()
                i.editReply("Don't make infinite loops you fucker")
            }
        }, 5000)
    }
}