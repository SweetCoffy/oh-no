import { createLobby, findValidLobby, lobbies } from '../lobby.js';
import { Command } from '../command-loader.js'
import { getUser, users } from '../users.js';
import { TextChannel } from 'discord.js';
import { moves } from '../moves.js';
import { getString } from '../locale.js';
import { Stats } from "../stats.js";
export var command: Command = {
    name: "choose",
    description: "ur mom",
    type: "CHAT_INPUT",
    options: [

        {
            type: "SUB_COMMAND",
            description: "bruv",
            name: "move",
            options: [
                {
                    name: "move",
                    type: "STRING",
                    required: true,
                    description: "bruhg",
                    choices: moves.map((el, k) => ({name: el.name, value: k}))
                },
                {
                    name: "target",
                    type: "INTEGER",
                    required: true,
                    description: "bruv",
                }
            ]
        },
        {
            type: "SUB_COMMAND",
            description: "bruv",
            name: "help",
            options: [
                {
                    name: "move",
                    type: "STRING",
                    required: true,
                    description: "bruhg",
                    choices: moves.map((el, k) => ({name: el.name, value: k}))
                },
            ]
        },
    ],
    async run(i) {
        if (!(i.channel instanceof TextChannel)) return await i.reply("big bruh")
        var u = getUser(i.user)
        switch (i.options.getSubcommand()) {
            case "move": {
                if (!u.lobby) return await i.reply("fuk yu")
                if (!u.lobby.battle) return await i.reply("fuk yu 2: electric boogaloo")
                var moveId = i.options.getString("move", true)
                var player = u.lobby.battle.players[i.options.getInteger("target", true)]
                //var player = u.lobby.battle.players.find(el => el.user?.id == target.id)
                if (!player) return await i.reply("bruv")
                var play = u.lobby.battle.players.find(el => el.user?.id == i.user.id)
                if (!play) return await i.reply("faeoighnesoirgjenrgedrgjoiershgnsdfibgheutirhg34weti9unsdrjegeoirthgn")
                u.lobby.battle.moveAction(play, moveId, player)
                await i.reply({
                    ephemeral: true,
                    content: "k"
                })
                break;
            }
            case "help": {
                var moveId = i.options.getString("move", true);
                var move = moves.get(moveId)
                if (move) {
                    var desc = getString("move.power", {VALUE: move.power ?? "-"}) + "\n"
                    + getString("move.accuracy", {VALUE: move.accuracy ?? "-"}) + "\n"
                    + getString("move.category", {VALUE: getString(move.category)}) + "\n"
                    + getString("move.type", {VALUE: getString(move.type)}) + "\n"
                    if (move.recoil) {
                        desc += getString("move.recoil", {VALUE: Math.floor(move.recoil * 100)}) + "\n"
                    }
                    if (move.description) {
                        desc += `${move.description}` + "\n"
                    }
                    function thing(num: number) {
                        if (num > 0) return `+${num}`
                        return `${num}`
                    }
                    function funi(boost: Stats) {
                        return Object.keys(boost).map(el => ({stat: el, boost: boost[el]})).filter(el => el.boost != 0)
                    }
                    var userStat = funi(move.userStat)
                    if (userStat.length) {
                        desc += getString("move.userstat") + "\n"
                        desc += userStat.map(el => `${getString(`stat.${el.stat}`)}: ${thing(el.boost)}`).join("\n") + "\n"
                    }
                    var targetStat = funi(move.targetStat)
                    if (targetStat.length) {
                        desc += getString("move.targetstat") + "\n"
                        desc += targetStat.map(el => `${getString(`stat.${el.stat}`)}: ${thing(el.boost)}`).join("\n") + "\n"
                    }
                    await i.reply({
                        embeds: [{
                            title: `${move.name}`,
                            description: desc
                        }]
                    })
                } else return new Error(`Unknown move: '${moveId}'`)
            }
        }
    }
}