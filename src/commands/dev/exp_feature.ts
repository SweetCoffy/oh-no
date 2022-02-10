import { Command } from "../../command-loader.js";
import { experimental, settings } from "../../util.js";

export var command: Command = {
    name: "feature",
    description: "Enables/Disables experimental features (dev only)",
    dev: true,
    options: [
        {
            name: "feature",
            description: "a",
            type: "STRING",
            choices: Object.keys(experimental).map(el => ({ name: el, value: el }))
        },
        {
            name: "value",
            description: "a",
            type: "BOOLEAN",
        }
    ],
    async run(i) {
        if (i.user.id != settings.ownerID) return await i.reply({content: "This command is for developers only"})
        var f = i.options.getString("feature", true)
        var v = i.options.getBoolean("value", true)
        //@ts-ignore
        experimental[f] = v
        await i.reply(`Experimental feature \`${f}\` is now ${v ? "Enabled" : "Disabled"}`)
    }
}