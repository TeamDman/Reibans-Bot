# Reibans-Bot
A bot that bans people for mentioning a guy named Rei on discord

## Setup

`git clone https://github.com/TeamDman/Reibans-Bot`

`cd Reibans-Bot`

`npm install`

## Running

`node app.js`

## Commands

#### /reibans help
Displays a list of commands.

#### /reibans inforaw
Displays the `config.json` in a richembed.

#### /reibans eval
Evaluates javascript

#### /reibans setraw index value
Executes `config[index]=value`

#### /reibans set channel #channel
Sets the reporting channel. Empty for no report messages.

#### /reibans set role @role
Sets the role to be used for muting people.

#### /reibans lockdown <enable|disable> \[all]
Prevents messages from being sent in the channel. 
If `all` is specified, then it applies to all channels.

#### /reibans lockdown setrole @role
Sets the role for overwrites to be applied to when lockdown is enabled.
Presumably, this is a role that everyone has, like @Lurker