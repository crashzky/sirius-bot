const {
    MongoClient
} = require('mongodb');
const {
    Telegraf,
    Markup
} = require('telegraf')
const fetch = require('node-fetch');

const uri = "";
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const BOT_TOKEN = '';
const bot = new Telegraf(BOT_TOKEN);

client.connect(err => {
    const collectionUsers = client.db('sirius').collection('users');

    //добавление нового пользователя
    function insertUser(ctx) {
        const insertUser = {
            chat_id: ctx.chat.id
        };

        collectionUsers.insertOne(insertUser, function (err, results) {
            ctx.reply('Рад тебя видеть!\nНачнём. Как тебя зовут?');
        });
    }

    //проверка на символы
    function checkSymbols(string, type) {
        const russian = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
        const numbers = '0123456789';

        let returnResult = true;
        switch (type) {
            case 'russian':
                string.toLowerCase().split('').forEach(i => {
                    if (!russian.includes(i))
                        returnResult = false;
                });
                break;
            case 'numbers':
                string.toLowerCase().split('').forEach(i => {
                    if (!numbers.includes(i))
                        returnResult = false;
                });
                break;
            case 'group':
                const req = string.toLowerCase().split('');
                if (!russian.includes(req[0]) || !numbers.includes(req[1]) || (req[2] && !numbers.includes(req[2])))
                    returnResult = false;
                break;
        }
        return returnResult;
    }

    //начало регистрации
    bot.command('start', (ctx) => {
        collectionUsers.find({
            chat_id: ctx.chat.id
        }).toArray((err, results) => {

            if (results.length !== 0) {
                ctx.reply('Хмм. Кажется, я тебя помню');
            } else {
                insertUser(ctx);
            }
        });
    });

    bot.on('text', (ctx) => {
        collectionUsers.find({
            chat_id: ctx.chat.id
        }).toArray((err, results) => {
            if (results.length === 0) {
                insertUser(ctx);
            } else if (!results[0].name) {

                if (ctx.message.text && ctx.message.text.length > 0 && checkSymbols(ctx.message.text, 'russian')) {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                name: ctx.message.text
                            }
                        },
                        () => {
                            ctx.reply('Хорошо. Сколько тебе лет?');
                        }
                    );
                } else {
                    ctx.reply('Используй пожалуйста только буквы русского алфавита');
                }

            } else if (!results[0].age) {

                if (ctx.message.text && ctx.message.text.length > 0 && checkSymbols(ctx.message.text, 'numbers')) {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                age: Number.parseInt(ctx.message.text)
                            }
                        },
                        () => {
                            ctx.reply('Отлично. В какой ты команде? (Н24, И3, С6 и т.д.)');
                        }
                    );
                } else {
                    ctx.reply('Используй пожалуйста только цифры');
                }

            } else if (!results[0].group) {

                if (ctx.message.text && ctx.message.text.length > 0 && checkSymbols(ctx.message.text, 'group')) {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                group: ctx.message.text
                            }
                        },
                        () => {
                            ctx.reply('Идём дальше. Прикрепи своё фото');
                        }
                    );
                } else {
                    ctx.reply('Укажи пожалуйста корректную команду (Н24, И3, С6 и т.д.)');
                }

            } else if (results[0].image_id && !results[0].description && results[0].description !== null) {

                let description = null;
                if (ctx.message.text !== 'Пропустить') {
                    description = ctx.message.text;
                }
                collectionUsers.updateOne({
                        chat_id: ctx.chat.id
                    }, {
                        $set: {
                            description
                        }
                    },
                    () => {
                        ctx.reply('Ну и на последок. Твой пол?', Markup
                            .keyboard([
                                ['Мужской', 'Женский']
                            ])
                            .oneTime()
                            .resize());
                    }
                );

            } else if (!results[0].gender) {

                if (ctx.message.text === 'Мужской' || ctx.message.text === 'Женский') {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                gender: ctx.message.text
                            }
                        },
                        () => {
                            ctx.reply('Последний вопрос. Какой пол интересен?', Markup
                                .keyboard([
                                    ['Мужской', 'Женский']
                                ])
                                .oneTime()
                                .resize());
                        }
                    );
                } else {
                    ctx.reply('Напиши пожалуйста корректный пол: Мужской/Женский');
                }

            } else if (!results[0].searchGender) {

                if (ctx.message.text === 'Мужской' || ctx.message.text === 'Женский') {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                searchGender: ctx.message.text
                            }
                        },
                        () => {
                            collectionUsers.find({
                                chat_id: ctx.chat.id
                            }).toArray(function (err, results) {
                                const user = results[0];
                                const caption = `${user.name}\n${user.age} лет\nКоманда: ${user.group}\n${user.description ? user.description + '\n' : ''}Твой пол: ${user.gender.toLowerCase()}\nИнтересен: ${user.searchGender.toLowerCase()}`;

                                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${user.image_id}`)
                                    .then(data => data.json())
                                    .then(json => ctx.replyWithPhoto({
                                        url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`
                                    }, {
                                        caption
                                    }))
                                    .then(() => ctx.reply('Всё верно?', Markup
                                        .keyboard([
                                            ['Да', 'Нет, перезаписать']
                                        ])
                                        .oneTime()
                                        .resize()));
                            });
                        }
                    );
                } else {
                    ctx.reply('Напиши пожалуйста корректный пол: Мужской/Женский');
                }

            } else if (!results[0].watchedList) {
                if (ctx.message.text === 'Да') {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                watchedList: []
                            }
                        },
                        () => {

                        }
                    );
                } else {
                    collectionUsers.deleteOne({
                        chat_id: ctx.chat.id
                    }, () => {
                        const insertUser = {
                            chat_id: ctx.chat.id
                        };
                
                        collectionUsers.insertOne(insertUser, function (err, results) {
                            ctx.reply('Окей. Начнём с начала.\nНачнём. Как тебя зовут?');
                        });
                    });
                }
            }
        });
    });

    bot.on('photo', (ctx) => {
        collectionUsers.find({
            chat_id: ctx.chat.id
        }).toArray((err, results) => {
            if (results.length === 0) {
                insertUser(ctx);
            } else if (results[0].group && !results[0].image_id) {
                collectionUsers.updateOne({
                        chat_id: ctx.chat.id
                    }, {
                        $set: {
                            image_id: ctx.message.photo[3].file_id
                        }
                    },
                    () => {
                        ctx.reply('Ещё немного и закончим. Расскажешь немного о себе? (Этот шаг можно пропустить)', Markup
                            .keyboard([
                                ['Пропустить']
                            ])
                            .oneTime()
                            .resize());
                    }
                );
            } else {
                ctx.reply('Кажется ты слишком рано отправил фото. Выполни сначала предыдущий шаг');
            }
        });
    });

    bot.launch();
});