const { log, error } = require("console")
const { Client, GatewayIntentBits, Events, EmbedBuilder, Collection, ActivityType } = require("discord.js")
const io = require("@pm2/io")

const backend = require("./backend.js")
const path = require("path")
const fs = require("fs")

require('dotenv').config()

let config = backend.loadConfig("config.yaml")

let questionData = {}
const reloadMetric = io.counter({name: "Reloads", id: "app/util/reloads"})

const questions = [
    {type: "world", commands: ["wbc", "worldbuilding"]},
    {type: "character", commands: ["cbc"]},
    {type: "plot", commands: ["pbc", "sbc"]},
    {type: "prompt", commands: ["prompts"]},
    {type: "ttrpg", commands: ["rpg"]}
]

if (process.env["PERSISTENT_ROOT"] == undefined) {
    process.env["PERSISTENT_ROOT"] = ""
}

// function updateSheets() {
//     let sheetId = process
// }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]})

// command importation
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands")
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file)
    const command = require(filePath)

    if ('data' in command && 'execute' in command) {
        // log(command.data.name)
        client.commands.set(command.data.name, command)
    } else {
        console.warn(`the command at ${filePath} is missing data/execute!`)
    }
}

client.once(Events.ClientReady, c => {
    log(`Ready, logged in as ${c.user.tag}`)
    client.user.setActivity(">help or /help", {type: ActivityType.Playing})
    if (!fs.existsSync(process.env["PERSISTENT_ROOT"] + "categories.csv")) {
        log("updating questions")
        backend.updateQuestions(config)
    }
    // log(config)
    questionData = backend.questionInit(config)
    // log(questionData.cats)
    // log("if ur cool then you will print this out")
    // log(worldQs)
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    // log(interaction)

    const command = interaction.client.commands.get(interaction.commandName)

    if (!command) {
        error(`No command matching ${interaction.commandName} found`)
        return;
    }

    try {
        await command.execute(interaction, {
            questionData,
            config
        })
    } catch (error) {
        console.error(error)
        if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
    }
})

client.addListener(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        return
    }
    let content = message.content
    if (content.slice(0, 1) != ">") { return }
    content = content.slice(1)
    let command = content.split(" ")[0]
    const params = content.split(" ")
    params.shift()
    command = command.toLowerCase()

    for (const question of questions) {
        if (command == question.type || question.commands.includes(command)) {
            // console.log(params);
            const selected = backend.thingPicker(questionData[question.type], params)
            await message.reply(pickDisplay(selected))
            return
        }
    }

    switch (command) {
        case "help":
            let out = "## Available commands\n"
            for (let data of config.help) {
                out += `- ${data.name} (${data.alts.join(", ")}): \`${data.usage}\`
    ${data.desc}\n`
            }
            out += "\nYou can use multiple filters by separating with spaces!\nAnd you can exclude by prefixing the filter with `-`!\n";
            out += "*Lost? Try `>wbc starter`!*"
            await message.reply(out)
            break;
        
        case "credits":
            let creditsFields = []
            for (const type in config.credits) {
                creditsFields.push({name: type, value: config.credits[type].join(", ")})
            }
            // log(creditsFields)
            let creditsEmbed = new EmbedBuilder()
                .setTitle("Credits")
                .setDescription("Who made the bot!")
                .addFields(
                    creditsFields
                )
                .addFields(
                    [{name: 'Links', value: `[Google Sheet](https://docs.google.com/spreadsheets/d/${config.sheetsId}/edit#gid=${config.sheets.categories})
[Github Link](https://github.com/Dlol/wrightehr-bhaohth)
[Obsidian Plugin](https://github.com/Dlol/writing-helper)
[Invite Link!](https://discord.com/api/oauth2/authorize?client_id=914374342341697556&permissions=380708588608&scope=bot)`}]
                )
                .setTimestamp()
            
            await message.reply({embeds: [creditsEmbed]})
            break;

        case "cats":
        case "categories":
            const {cats} = questionData
            if (params[0]) {
                let source = cats.world
                switch (params[0]) {
                    case "character":
                        source = cats.character
                        break;
                    
                    case "prompts":
                        source = cats.prompt
                        break;
                    
                    case "plot":
                        source = cats.plot
                        break;

                    case "ttrpg":
                        source = cats.ttrpg
                        break;

                    default:
                        break;
                }
                let wbText = ""
                for (let key in source) {
                    wbText += `- **${key}**: ${source[key]}\n`
                }
                await message.reply(wbText)
                break;
            }
            let wbText = ""
            for (let key in cats.world) {
                wbText += `- ${key}\n`
            }
            let charText = ""
            for (let key in cats.character) {
                charText += `- ${key}\n`
            }
            let promptText = ""
            for (let key in cats.prompt) {
                promptText += `- ${key}\n`
            }
            let plotText = ""
            for (let key in cats.plot) {
                plotText += `- ${key}\n`
            }
            let ttrpgText = ""
            for (let key in cats.ttrpg) {
                ttrpgText += `- ${key}\n`
            }
            let embed = new EmbedBuilder()
                .setTitle("Writer Bot Categories")
                .setDescription("Current categories that can be filtered by")
                .addFields(
                    {name: "Worldbuilding", value: wbText},
                    {name: "Character", value: charText},
                    {name: "Prompts", value: promptText},
                    {name: "Plot", value: plotText},
                    {name: "TTRPG", value: ttrpgText}
                )
                .setFooter({ text: "Use >categories [type] to get more details!"})
                .setTimestamp()
            
            await message.channel.send({embeds: [embed]})
            break;

        case "download":
        case "reload":
        case "update":
            if (!config.reloadAllowed.includes(message.author.id)) {
                await message.channel.send("you dont have valid perms >:(");
                return;
            }
            await message.channel.send("starting...")
            config = backend.loadConfig("config.yaml")
            backend.updateQuestions(config, async () => {
                questionData = backend.questionInit(config)
                await message.channel.send("done!")
            })
            reloadMetric.inc()
            break;
        
        case "random":
        case "roll":
            let amt = 6
            if (params[0]) {
                amt = Number(params[0])
                if (Number.isNaN(amt)) {
                    amt = 6
                }
            }
            let rand = Math.floor((Math.random() * amt) + 1)
            await message.reply(`Your result is: ${rand} (max: ${amt})`)
            break;
        
        default:
            break;
    }
})

function pickDisplay(thing) {
    if (!thing) { return "Nothing matches your filters!" }
    return `${thing.slice(0, 1)} \`[${thing.slice(1).join(", ")}]\``
}

client.login(process.env["DISCORD_TOKEN"])