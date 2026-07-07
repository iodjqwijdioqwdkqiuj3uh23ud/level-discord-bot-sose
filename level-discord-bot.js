const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI).then(() => console.log('DB 연결 성공!'));

const UserSchema = new mongoose.Schema({ userId: String, level: { type: Number, default: 1 }, xp: { type: Number, default: 0 } });
const User = mongoose.model('User', UserSchema);

// 레벨 경험치 계산 (100 * level^1.5)
const getRequiredXP = (level) => Math.floor(100 * Math.pow(level, 1.5));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    let user = await User.findOne({ userId: message.author.id }) || new User({ userId: message.author.id });
    user.xp += 10;
    if (user.xp >= getRequiredXP(user.level)) {
        user.xp = 0; user.level += 1;
        message.channel.send(`${message.author.username}님이 ${user.level}레벨이 되었습니다!`);
    }
    await user.save();
});

// 명령어 등록 및 처리 (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === '레벨') {
        const sub = interaction.options.getSubcommand();
        if (sub === '조회') {
            const user = await User.findOne({ userId: interaction.user.id });
            interaction.reply(`현재 레벨: ${user?.level || 1}, XP: ${user?.xp || 0}`);
        } else if (sub === '지급' && interaction.member.permissions.has('Administrator')) {
            const target = interaction.options.getUser('유저');
            const newLevel = interaction.options.getInteger('레벨');
            await User.findOneAndUpdate({ userId: target.id }, { level: newLevel }, { upsert: true });
            interaction.reply(`${target.username}님의 레벨을 ${newLevel}로 변경했습니다.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);