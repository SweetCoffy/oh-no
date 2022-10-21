import { CommandInteraction, Collection, Guild, ContextMenuCommandInteraction, ChatInputApplicationCommandData, UserApplicationCommandData, AutocompleteInteraction } from "discord.js";
import { statSync, readdirSync } from "fs"
import { resolve, join } from "path"
import { settings } from "./util.js"
export type ChatInputCommand = ChatInputApplicationCommandData & { run(i: CommandInteraction): any}
export type UserCommand = UserApplicationCommandData & { run(i: ContextMenuCommandInteraction): any }

export type Command = (ChatInputCommand | UserCommand) & {dev?: boolean, autocomplete?(i: AutocompleteInteraction): any}

export var commands: Collection<string, Command> = new Collection()

export async function load(file: string) {
    var h: Command = (await import(file)).command
    commands.set(h.name, h)
    return h
}

export async function loadDir(dir: string) {
    var fulldir = resolve(`./build/${dir}`)
    function readdirRecursive(dir: string) {
        var files: string[] = []
        for (var f of readdirSync(dir)) {
            var p = join(dir, f)
            if (f.startsWith("stable_") && settings.experimental) continue;
            if (f.startsWith("exp_") && !settings.experimental) continue;
            if (statSync(p).isDirectory()) {
                files.push(...readdirRecursive(p))
                continue
            }
            files.push(p)
        }
        return files
    }
    var files = readdirRecursive(fulldir)
    return (await Promise.allSettled(files.map(el => load(`${el}`)))).map((v, i) => ({file: files[i], value: v}))
}

export async function addCommands(g: Guild, cmds: Command[]) {
    if (!process.argv.includes("-update")) return
    await Promise.all(cmds.map(el => {
        if ("description" in el) {
            el.description += " (Test)"
        }
        return g.commands.create(el)
    }))
}