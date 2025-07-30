import { CommandInteraction, Collection, Guild, ContextMenuCommandInteraction, ChatInputApplicationCommandData, UserApplicationCommandData, AutocompleteInteraction, ModalSubmitInteraction, AnySelectMenuInteraction, ButtonInteraction } from "discord.js";
import { statSync, readdirSync } from "fs"
import { resolve, join } from "path"
import { settings } from "./util.js"
export type ChatInputCommand = ChatInputApplicationCommandData & { run(i: CommandInteraction): any}
export type UserCommand = UserApplicationCommandData & { run(i: ContextMenuCommandInteraction): any }

export type Command = (ChatInputCommand | UserCommand) &
{
    dev?: boolean,
    associatedCustomIds?: string[],
    autocomplete?(i: AutocompleteInteraction): any,
    modalSubmit?(i: ModalSubmitInteraction): any,
    // selectMenu?(i: AnySelectMenuInteraction): any,
    // button?(i: ButtonInteraction): any,
    interaction?(i: ButtonInteraction | AnySelectMenuInteraction): any,
}

export let commands: Collection<string, Command> = new Collection()
export let customIds: Collection<string, Command> = new Collection()

export async function load(file: string) {
    let h: Command = (await import(file)).command
    commands.set(h.name, h)
    if (h.associatedCustomIds) {
        for (let id of h.associatedCustomIds) {
            if (id.endsWith(":")) id = id.slice(0, id.length - 1)
            customIds.set(id, h)
        }
    }
    return h
}
const sourceDir = ("Bun" in globalThis) ? "./src" : "./build"
export async function loadDir(dir: string) {
    let fulldir = resolve(`./${sourceDir}/${dir}`)
    function readdirRecursive(dir: string) {
        let files: string[] = []
        for (let f of readdirSync(dir)) {
            let p = join(dir, f)
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
    let files = readdirRecursive(fulldir)
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