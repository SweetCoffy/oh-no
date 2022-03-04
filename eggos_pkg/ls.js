(async function() {
    var path = joinpath(argv[0] || "/")
    var files = await readDir(path)
    console.log(`**${path}**\n${files.join("\n")}`)
})()