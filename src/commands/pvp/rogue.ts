import { ActionRowBuilder, ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, codeBlock } from "discord.js";
import { Command } from "../../command-loader";
import { getUser } from "../../users";
import { RogueGame } from "../../rogue_mode";

function rogueInfoMessage(rogue: RogueGame) {
    let msg = rogue.infoMessage()
    let room = rogue.room
    return {
        embeds: [
            {
                description: codeBlock("ansi", msg)
            }
        ],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setLabel("Inventory").setCustomId("rogue:inventory").setStyle(ButtonStyle.Secondary),
                ...room.exits.map((el, i) => new ButtonBuilder()
                    .setLabel(`Room: ${el.getName()}`)
                    .setDisabled(!el.canExit)
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`rogue:advance_${i}`))
            ),
        ]
    }
}

export let command: Command = {
    name: "rogue",
    description: "b",
    associatedCustomIds: ["rogue:"],
    type: ApplicationCommandType.ChatInput,
    options: [{
        type: ApplicationCommandOptionType.Subcommand,
        name: "solo",
        description: "g"
    }, {
        type: ApplicationCommandOptionType.Subcommand,
        name: "info",
        description: "info"
    }],
    async interaction(i) {
        if (!i.isButton()) return;
        let u = getUser(i.user)
        if (!u.rogue) return await i.reply({ flags: ["Ephemeral"], content: "You are not in a game." })
        let rogue = u.rogue
        if (i.customId.startsWith("rogue:advance_")) {
            let index = parseInt(i.customId.slice(14))
            if (isNaN(index) || index < 0 || index >= rogue.room.exits.length) {
                return await i.reply({ flags: ["Ephemeral"], content: "how" });
            }
            if (!rogue.advance(index)) {
                return await i.reply({ flags: ["Ephemeral"], content: "You can't escape." });
            }
            await i.deferUpdate()
            await rogue.broadcast(rogue.infoMessage())
        }
    },
    async run(i: ChatInputCommandInteraction) {
        let u = getUser(i.user)
        let rogue = u.rogue
        switch (i.options.getSubcommand(true)) {
            case "solo": {
                if (rogue) return await i.reply("You're already in a game.")
                let game = new RogueGame()
                if (i.channel?.isSendable()) {
                    game.channels.push(i.channel)
                }
                game.join(i.user)
                await i.reply(rogueInfoMessage(game))
                break
            }
            case "info": {
                if (!rogue) return await i.reply("You're not in a game.")
                if (rogue.inBattle) return await i.reply("You must finish combat first.")
                await i.reply(rogueInfoMessage(rogue))
                break
            }
        }
    }
}