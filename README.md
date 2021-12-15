# oh-no
yes.

## Running
In order to run this bot, you must have the TypeScript compiler installed

Use the command `tsc` to compile, or use `tsc --watch` to have it automatically compile as you make changes
After compiling, do `node .` to run, but before running, create a `config.json` file in the parent directory with the following contents:
```json
{
    // The bot token
    "token": "",
    // The ID of the test guild (used for creating slash commands for testing without the time it takes to deploy globally)
    "test_guild": "",
    // The ID of the bot owner (user for owner only commands like reload)
    "owner_id": "",
}
```