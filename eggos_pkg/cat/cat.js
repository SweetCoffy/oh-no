(async function() {
    let path = joinpath(argv[0] || "/")
    let file = await readFile(path)
    console.log(file.toString())
})()