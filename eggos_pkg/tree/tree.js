(async function () {
    let libtree = await load("tree")
    let path = joinpath(argv[0] || "/")
    let files = await libtree.tree(path)
    console.log(`**${path}**\n${files.join("\n")}`)
})()