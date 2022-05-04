(async function () {
    var libtree = await load("tree")
    var path = joinpath(argv[0] || "/")
    var files = await libtree.tree(path)
    console.log(`**${path}**\n${files.join("\n")}`)
})()