import { Command } from "../command-loader.js"
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

export let command: Command = {
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
    async run(i: discord.ChatInputCommandInteraction) {
        await i.reply("nope")
    }
}