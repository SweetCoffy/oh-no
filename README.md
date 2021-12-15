# oh-no
yes.

## Running
In order to run this bot, you must have the TypeScript compiler installed

Use the command `tsc` to compile, or use `tsc --watch` to have it automatically compile as you make changes
After compiling, do `node .` to run, but before running, create a `config.json` file in the parent directory with the following contents:
```jsonc
{
    "token": "Bot token goes here",
    "test_guild": "Test guild ID goes here",
    "owner_id": "Bot owner ID goes here"
}
```
