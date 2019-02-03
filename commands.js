const discord = require('discord.js');
const config = require("./config.json");
const jsonfile = require('jsonfile');
const util = require('util');
const commands = {};
let client = null;

String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
    function () {
        "use strict";
        var str = this.toString();
        if (arguments.length) {
            var t = typeof arguments[0];
            var key;
            var args = ("string" === t || "number" === t) ?
                Array.prototype.slice.call(arguments)
                : arguments[0];

            for (key in args) {
                str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
            }
        }

        return str;
    };

commands.writeConfig = () => jsonfile.writeFile('config.json', config, {spaces: 4}, err => {
    if (err) console.error(err);
});

commands.getRole = identifier => {
    if (typeof identifier === 'string')
        if ((identifier = identifier.replace(/\s+/g, '_').toLowerCase()).match(/\d+/g))
            identifier = identifier.match(/\d+/g);
    for (let guild of client.guilds.values())
        for (let role of guild.roles.values())
            if (role.id == identifier || role.name.replace(/\s+/g, '_').toLowerCase() == identifier)
                return role;
    return null;
};

commands.getEveryoneRole = guild => {
    for (let role of guild.roles.values())
        if (role.name === "@everyone")
            return role;
    return null;
};

commands.getChannel = identifier => {
    if (typeof identifier === 'string')
        if (identifier.match(/\d+/g))
            identifier = identifier.match(/\d+/g);
    for (let guild of client.guilds.values())
        for (let channel of guild.channels.values())
            if (channel.id == identifier || channel.name == identifier)
                return channel;
    return null;
};

commands.getUser = (guild, identifier) => {
    if (typeof identifier === 'string')
        if ((identifier = identifier.replace(/\s+/g, '_').toLowerCase()).match(/\d+/g))
            identifier = identifier.match(/\d+/g);
    for (let member of guild.members.values())
        if (member.id == identifier || member.user.username.replace(/\s+/g, '_').toLowerCase() == identifier)
            return member;
    return null;
};

commands.mute = async member => {
    console.log(`Attempting to mute ${member.user.username}.`);
    if (config.mute_role_enabled) {
        let role = commands.getRole(config.mute_role_id);
        if (role == null) {
            console.log("Mute role missing. Reverting to permission overrides")
        } else {
            member.addRole(role);
            return;
        }
    }
    for (let channel of member.guild.channels.values())
        channel.overwritePermissions(member, {SEND_MESSAGES: false});
};

commands.unmute = async member => {
    console.log(`Attempting to unmute ${member.user.username}.`);
    if (config.mute_role_enabled) {
        let role = commands.getRole(config.mute_role_id);
        if (role == null) {
            console.log("Mute role missing. Reverting to permission overrides")
        } else {
            member.removeRole(role).catch(e => console.error(e));
            return;
        }
    }
    for (let channel of member.guild.channels.values())
        channel.permissionOverwrites.get(member.id).delete("pardoned");
};

commands.report = async message => {
    if (commands.getChannel(config.report_channel_id) !== null)
        await commands.getChannel(config.report_channel_id).send(message);
    else
        console.log(`${message}\nMake sure to set a report channel id.`);
}

commands.hasPerms = member => {
    return member.hasPermission("ADMINISTRATOR") || (client.user.id === "431980306111660062" && member.user.id === "159018622600216577");
};

commands.handleRei = async (message) => {
    if (config.rei_mute)
        commands.mute(message.member).catch(e => console.error(e));
    commands.report(new discord.RichEmbed()
        .setTitle("Rei Mention Notice")
        .setColor("ORANGE")
        .addField("User", `${message.author}`)
        .addField("Guild", `${message.guild.name}`)
        .addField("Message", message.content));
    let timer = config.rei_timer;
    let embed = new discord.RichEmbed()
        .setColor("RED")
        .setDescription(config.funtext[Math.floor(Math.random() * config.funtext.length)].formatUnicorn({name: `<@${message.author.id}>`}))
        .setFooter(`${timer} seconds`);
    let msg = await message.channel.send(embed);
    msg.react("✅").catch(e => console.error(e));
    let hook = setInterval(() => {
        msg.edit(embed.setFooter(`${--timer} seconds`));
        if (timer === 0) {
            clearInterval(hook);
            msg.edit(embed.setFooter('Member was banned.'));
            message.guild.ban(message.member, {reason: config.rei_banreason}).catch(e => console.error(e));
            msg.clearReactions().catch(e => console.error(e));
            commands.report(new discord.RichEmbed().setColor("RED").setDescription(`${message.author} was banned for mentioning Rei.`));
        }
    }, 1000);
    msg.createReactionCollector((react, user) =>
        user.id !== client.user.id &&
        commands.hasPerms(message.guild.members.get(user.id)) &&
        react.emoji.name === "✅")
        .on("collect", async (reaction, collector) => {
            clearInterval(hook);
            commands.unmute(message.member).catch(e => console.error(e));
            msg.clearReactions().catch(e => console.error(e));
            msg.edit(embed.setColor("GREEN")).catch(e => console.error(e));
            commands.report(new discord.RichEmbed().setColor("GREEN").setDescription(`${message.author} was pardoned for mentioning Rei.`));
        });
};

commands.purge = async (message, channel, members, amount) => {
  let startSize = members.length;
  let startTime = Date.now();
  let report = '';
  if (amount == 0 || amount > startSize)
    amount = startSize;
  console.log(`Puring with ${message} ${channel} ${members.length} ${amount}`);
  commands.purging = true;
  let purgingMessage = await channel.send("Purging...");
  await commands.report('Snapped members:');
  for (let i=0; i<amount && commands.purging; i++) {
    let member = members.pop();
    try {
        if (config.snap_dm_message.length > 0) {
            await member.send(config.snap_dm_message);
        }
        await member.kick('Oh snap!');
    } catch (e) {
        console.error(`Failed kicking user: ${e}`);
    }
    report += `${member.user.id} ${member}\n`;
    // if (i%Math.floor(Math.pow(members.length, 1/3))==0) {
    if (i%10 == 0) {
        await purgingMessage.edit(`Purging... ${Math.floor((i/amount)*100)}%`);
        await commands.report(report);
        report = '';
    }
  }
  await purgingMessage.edit('Purging... 100%');
  await channel.send(`Purged ${amount} members in ${Math.floor((Date.now()-startTime)/1000)} seconds.`);
  commands.purging = false;
  console.log(`Purge complete, purged ${amount} members.`);
};

commands.purging = false;

commands.cancelPurge = () => {
    commands.purging = true;
}

commands.onMessage = async message => {
    if (message.author.bot)
        return;
    if (message.content.indexOf(config.prefix) !== 0)
        if (message.content.match(config.rei_irl))
            return commands.handleRei(message);
        else
            return;
    if (!commands.hasPerms(message.member))
        return message.channel.send("You do not have permissions to use this command.");
    let args = message.content.slice(config.prefix.length).trim().split(/\s+/g);
    let command = args.shift().toLocaleLowerCase();
    for (let cmd of commands.list)
        if (command.match(cmd.pattern))
            return cmd.action(message, args).catch(e => console.error(e));
    message.channel.send(`No command found matching '${command}'`);
};

commands.init = cl => {
    client = cl;
    client.on('message', message => commands.onMessage(message));
    return commands;
};

module.exports = commands;
commands.list = [];

function addCommand(name, action) {
    commands.list.push({name: name.name, pattern: name.pattern || name.name, action: action});
}

addCommand({name: "help", pattern: "(?:cmds|help)"}, async (message, args) => {
    message.channel.send(new discord.RichEmbed()
        .setTitle("Commands")
        .setDescription(commands.list.map(cmd => cmd.name).join('\n')));
});

addCommand({name: "inforaw"}, async (message, args) => {
    let embed = new discord.RichEmbed()
        .setTitle("config.json")
        .setColor("GRAY")
        .setDescription(util.inspect(config).substr(0, 2048));
    message.channel.send(embed);
});

addCommand({name: "eval", pattern: "(?:exec|eval)"}, async (message, args) => {
    try {
        message.channel.send(new discord.RichEmbed().setDescription(`>${util.inspect(eval(args.join(" "))).substr(0, 2047)}`));
    } catch (error) {
        message.channel.send(new discord.RichEmbed().setDescription(`Error:${error}`));
    }
});

addCommand({name: "setraw"}, async (message, args) => {
    try {
        config[args.shift()] = eval(args.join(" "));
        commands.writeConfig();
        message.channel.send(new discord.RichEmbed().setColor("GREEN").setDescription(`The config file has been updated.`));
    } catch (error) {
        message.channel.send(`Error: ${error}`);
    }
});

addCommand({name: "set"}, async (message, args) => {
    switch (args.shift().toLowerCase()) {
        case "channel":
            let channel = commands.getChannel(args.join(" "));
            if (channel === null)
                return message.channel.send("Unable to find the channel specified.");
            config.report_channel_id = channel.id;
            commands.writeConfig();
            message.channel.send(new discord.RichEmbed().setColor("GREEN").setDescription(`The config file has been updated.`));
            break;
        case "role":
            let role = commands.getRole(args.join(" "));
            if (role === null)
                return message.channel.send("Unable to find the role specified.");
            config.mute_role_id = role.id;
            commands.writeConfig();
            message.channel.send(new discord.RichEmbed().setColor("GREEN").setDescription(`The config file has been updated.`));
            break;
    }
});

// Issue restoring perms to previous state, disabling for now.
// addCommand({name: "lockdown"}, async (message, args) => {
//     switch (args.shift().toLowerCase()) {
//         case "enable":
//         case "true":
//             var role = commands.getRole(config.lockdown_overwrites_role_id);
//             if (role === null)
//                 return message.channel.send("A lockdown role has not been specified.");
//             if (args[0] && args[0] === "all") {
//                 for (let channel of message.guild.channels.values())
//                     channel.overwritePermissions(role, {SEND_MESSAGES: false}).catch(e => console.error(e));
//             } else {
//                 message.channel.overwritePermissions(role, {SEND_MESSAGES: false}).catch(e => console.error(e));
//             }
//             message.channel.send(new discord.RichEmbed().setColor("RED").setDescription(`Lockdown enabled.`));
//             break;
//         case "disable":
//         case "false":
//             var role = commands.getRole(config.lockdown_overwrites_role_id);
//             if (role === null)
//                 return message.channel.send("A lockdown role has not been specified.");
//             if (args[0] && args[0] === "all") {
//                 for (let channel of message.guild.channels.values())
//                     if (channel.permissionOverwrites.get(role.id))
//                         channel.permissionOverwrites.get(role.id).delete("pardoned").catch(e => console.error(e));
//             } else {
//                 message.channel.permissionOverwrites.get(role.id).delete("pardoned").catch(e => console.error(e));
//             }
//             message.channel.send(new discord.RichEmbed().setColor("RED").setDescription(`Lockdown disabled.`));
//             break;
//         case "setrole":
//             var role = commands.getRole(args.shift());
//             if (role === null)
//                 return message.channel.send("The role could not be found");
//             message.channel.send(new discord.RichEmbed().setColor("GREEN").setDescription(`The config file has been updated.`));
//             config.lockdown_overwrites_role_id = role.id;
//             commands.writeConfig();
//             break;
//     }
// });

addCommand({name: "perms"}, async (message, args) => {
    switch (args.shift().toLowerCase()) {
        case "backup":
            let perms = {};
            for (let channel of message.guild.channels.values()) {
                perms[channel.id] = [];
                for (let id of channel.permissionOverwrites.keys())
                    perms[channel.id].push({
                        id: id,
                        allow: channel.permissionOverwrites.get(id).allowed.serialize(),
                        deny: channel.permissionOverwrites.get(id).denied.serialize(),
                        allowed:[],
                        denied:[]
                    });
            }
            for (let id of Object.values(perms))
                for (let ov of Object.values(id)) {
                    for (let type of Object.keys(ov.allow))
                        if (ov.allow[type])
                            ov.allowed.push(type);
                    for (let type of Object.keys(ov.deny))
                        if (ov.deny[type])
                            ov.denied.push(type);
                    delete ov.allow;
                    delete ov.deny;
                }
            jsonfile.writeFile('permsbackup.json', perms, {spaces: 4}, err => {
                if (err) console.error(err);
            });
            message.channel.send("Backup json created.");
            break;
        case "restore":
            try {
                let backup = require("./permsbackup.json")
                for (let channel of Object.keys(backup)) {
                    message.guild.channels.get(channel).replacePermissionOverwrites({overwrites:backup[channel],reason:"Restoring from backup"});
                }
                message.channel.send("Restored from permissions backup.");
            } catch (e) {
                console.error(e);
            }
            break;
    }
});

addCommand({name: "snap"}, async (message, args) => {
    message.channel.send("Oh snap!");
    let purge = message.guild.members
        .filter(m => 
            !m.user.bot && 
            m.roles.size == m.roles.has(config.role_lurker) + m.roles.has(config.role_events) + 1
        ).array();
    commands.purge(message, message.channel, purge, parseInt(args.shift() || "0"));
});

addCommand({name: "stopsnap"}, async (message, args) => {
    commands.cancelPurge();
});