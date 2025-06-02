// "stable" version info command
import { ActionRowBuilder, ApplicationCommandOptionType, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, codeBlock, StringSelectMenuBuilder } from "discord.js"
import { calcMul, Player, StatModifier, statusTypes, teamNames } from "../../battle.js"
import { Command } from "../../command-loader.js"
import { StatID } from "../../stats.js"
import { getUser } from "../../users.js"
import { bar, barDelta, formatString, playerSelectorComponent } from "../../util.js"
import { getString } from "../../locale.js"
import { moves } from "../../moves.js"
import { dispDelta, dispMul, fnum } from "../../number-format.js"
function playerInfoString(player: Player, details: boolean) {
    let finalStats = player.getFinalStats()
    function dispMod(mod: StatModifier) {
        if (mod.type == "add") {
            return dispDelta(mod.value, true)
        }
        if (mod.multCombine == "add")
            return dispMul(mod.value, true, true)
        return dispMul(mod.value, false, true)
    }
    function statsString() {
        return Object.keys(player.modifiers).map(el => {
            let mds = player.modifiers[el as StatID]

            return formatString(`${getString("stat." + el).padEnd(12, " ")} [a]${fnum(player.stats[el as StatID])}[r] ${dispDelta(Math.ceil(finalStats[el as StatID] - player.stats[el as StatID]), true)}`
                + (details ? `\n${mds.filter(el => !el.disabled)
                    .map(el => {
                        return `· ${el.label || "Unknown Modifier"}: ${dispMod(el)}`
                    })
                    .join("\n")}` : ``).trimEnd())
        }).join("\n")
    }
    return codeBlock("ansi",
        `${player.name.padEnd(32, " ")} Lv ${player.level}\nHP ${barDelta(player.hp, player.prevHp, player.maxhp, 32)}|\n${fnum(player.hp)}/${fnum(player.maxhp)}${player.absorption > 0 ? `\n\nT${player.absorptionTier} ${bar(player.absorption, player.maxhp, 20)}|\n${fnum(player.absorption)}/${fnum(player.maxhp)}\n` : ``}\nCHG ${player.charge.toString().padStart(3, " ")}  MAG ${player.magic.toString().padStart(3, " ")}\nDeath Point: ${fnum(-player.plotArmor)} HP (effectively ${fnum(player.hp + player.plotArmor)} HP)\n${player.status.map(el => {
            return `· ${statusTypes.get(el.type)?.name} — ${el.turnsLeft.toString().padEnd(2, " ")} turns left`
        }).join("\n") || "No status effects."}\n` +
        `\n${statsString()}\n` + (details ? `Moveset:\n${player.moveset.map(v => `· ${moves.get(v)?.name}`).join("\n")}\n` : ``)
    )
}
export let command: Command = {
    type: ApplicationCommandType.ChatInput,
    name: "info",
    description: "pingery",
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: "player",
            required: false,
            description: "a",
            autocomplete: true,
        }
    ],
    associatedCustomIds: ["info:"],
    async interaction(i) {
        let u = getUser(i.user)
        let battle = u.lobby?.battle
        if (!battle)
            return await i.reply({ flags: ["Ephemeral"], content: "what" })
        let currentPlayer = battle.players.find(el => el.user?.id == i.user.id)
        if (!currentPlayer)
            return await i.reply({ flags: ["Ephemeral"], content: "what 2" })
        if (i.isButton() && i.customId == "info:open_selector") {
            return await i.reply({
                content: `Choose a player to view info.`,
                flags: ["Ephemeral"],
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>()
                        .setComponents(playerSelectorComponent(currentPlayer, battle, "info:player_info")),
                ]
            })
        }
        if (i.isStringSelectMenu() && i.customId == "info:player_info") {
            let player = battle.players.find(el => el.id == i.values[0])
            if (!player)
                return await i.update(({ content: codeBlock(`Player not found.`) }))
            let details = currentPlayer && !battle.isEnemy(player, currentPlayer)
            return await i.update({
                content: playerInfoString(player, details),
            })
        }
    },
    async autocomplete(i) {
        let u = getUser(i.user)
        if (!u.lobby?.battle) return await i.respond([])
        let b = u.lobby.battle;
        return await i.respond(b.players.map((el, i) => ({name: `#${i} ${el.name} (${Math.floor(el.hp / el.maxhp * 100)}%, Team ${teamNames[el.team]})`, value: i + ""})))
    },
    async run(i: ChatInputCommandInteraction) {
        function findPlayerID(name: string) {
            let split = name.split(" ")
            let num = parseInt(split[0])
            return num || Number(name)
        }
        let lobby = getUser(i.user).lobby
        if (!lobby?.battle) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        let idx = findPlayerID(i.options.getString("player", false) || "") ?? lobby.battle.players.findIndex(el => el.user?.id == i.user.id)
        let player = lobby.battle.players[idx]
        let userPlayer = lobby.battle.players.find((v) => v.user?.id == i.user.id)
        if (!player) return await i.reply({
            ephemeral: true,
            content: "bruh",
        })
        let details = userPlayer && !lobby.battle.isEnemy(player, userPlayer)
        await i.reply({
            ephemeral: true,
            content: playerInfoString(player, !!details),
        })
    }
}