const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

// 1. 클라이언트 설정 (인텐트 필수)
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

// 2. MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('DB 연결 성공!'))
    .catch(err => console.error('DB 연결 실패:', err));

const UserSchema = new mongoose.Schema({ 
    userId: String, 
    level: { type: Number, default: 1 }, 
    xp: { type: Number, default: 0 } 
});
const User = mongoose.model('User', UserSchema);

const getRequiredXP = (level) => Math.floor(100 * Math.pow(level, 1.5));

// 3. 봇 준비 및 슬래시 명령어 등록
client.on('ready', async () => {
    console.log(`${client.user.tag}으로 로그인 완료!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('레벨')
            .setDescription('레벨 시스템 명령어')
            .addSubcommand(sub => sub.setName('조회').setDescription('내 레벨을 조회합니다'))
            .addSubcommand(sub => sub.setName('지급')
                .setDescription('유저 레벨을 강제로 수정합니다 (관리자 전용)')
                .addUserOption(option => option.setName('유저').setDescription('대상 유저').setRequired(true))
                .addIntegerOption(option => option.setName('레벨').setDescription('변경할 레벨').setRequired(true))
            )
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('슬래시 명령어 등록 완료!');
    } catch (error) {
        console.error('명령어 등록 오류:', error);
    }
});

// 4. 채팅 메시지 처리 (경험치 증가)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    let user = await User.findOne({ userId: message.author.id }) || new User({ userId: message.author.id });
    
    user.xp += 10;
    if (user.xp >= getRequiredXP(user.level)) {
        user.xp = 0; 
        user.level += 1;
        message.channel.send(`${message.author.username}님이 ${user.level}레벨이 되었습니다!`);
    }
    await user.save();
});

// 5. 슬래시 명령어 처리
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === '레벨') {
        const sub = interaction.options.getSubcommand();
        if (sub === '조회') {
            const user = await User.findOne({ userId: interaction.user.id });
            await interaction.reply(`현재 레벨: ${user?.level || 1}, XP: ${user?.xp || 0}`);
        } else if (sub === '지급' && interaction.member.permissions.has('Administrator')) {
            const target = interaction.options.getUser('유저');
            const newLevel = interaction.options.getInteger('레벨');
            await User.findOneAndUpdate({ userId: target.id }, { level: newLevel }, { upsert: true });
            await interaction.reply(`${target.username}님의 레벨을 ${newLevel}로 변경했습니다.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
