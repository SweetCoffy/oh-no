(async function() {
    let path = joinpath(argv[0] || "/")
    let files = await readDir(path)
    console.log(`**${path}**\n${files.join("\n")}`)
})()