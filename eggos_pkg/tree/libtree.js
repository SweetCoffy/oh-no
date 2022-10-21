async function tree(path) {
    let files = []
    let dir = await readDir(path)
    for (let file of dir) {
        files.push(joinpath(path, file))
        try {
            if (typeof (await readFile(joinpath(path, file))) == "object") files.push(...await tree(joinpath(path, file)))
        } catch (er) {
            //console.log(er)
        }
    }
    return files
};
({tree})