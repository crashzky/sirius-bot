const {
    MongoClient
} = require('mongodb');
const {
    Telegraf,
    Markup
} = require('telegraf')
const fetch = require('node-fetch');

const uri = "mongodb+srv://admin:admin@cluster.lirk6.mongodb.net/sirius?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const BOT_TOKEN = '1822618060:AAG1fif7rFJXuEWnerQpZf5pGKyh4QdtR04';
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

    //отправить мою анкету с меню
    function sendMenu(ctx, user) {
        const caption = `${user.name}\n${user.age} лет\nКоманда: ${user.group}\n${user.description ? user.description + '\n' : ''}Твой пол: ${user.gender.toLowerCase()}\nИнтересен: ${user.searchGender.toLowerCase()}`;

        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${user.image_id}`)
            .then(data => data.json())
            .then(json => ctx.replyWithPhoto({
                url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`
            }, {
                caption
            }))
            .then(() => ctx.reply('Что буем делать?', Markup
                .keyboard([
                    ['Смотреть анкеты'],
                    ['Перезаписать мою анкету']
                ])
                .oneTime()
                .resize()));
    }

    function sendForm(ctx, results) {
        collectionUsers.find({
            searchGender: results[0].gender.toLowerCase()
        }).toArray((err, searchResults) => {
            if (searchResults.length === 0) {
                collectionUsers.updateOne({
                        chat_id: ctx.chat.id
                    }, {
                        $set: {
                            watchedList: []
                        }
                    },
                    () => {
                        sendMenu(ctx, results[0]);
                    }
                );
            } else {
                searchResults.forEach(i => {
                    if (!results[0].watchedList.includes(i.chat_id)) {
                        const caption = `${i.name}\n${i.age} лет\n${i.description ? i.description + '\n' : ''}Твой пол: ${i.gender.toLowerCase()}\nИнтересен: ${i.searchGender.toLowerCase()}`;

                        collectionUsers.updateOne({
                                chat_id: ctx.chat.id
                            }, {
                                $set: {
                                    formNow: i.chat_id
                                }
                            },
                            () => {

                            }
                        );

                        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${i.image_id}`)
                            .then(data => data.json())
                            .then(json => ctx.replyWithPhoto({
                                url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`
                            }, {
                                caption
                            }))
                            .then(() => ctx.reply('Нашёл кое-что. Как тебе?', Markup
                                .keyboard([
                                    ['❤️️', '👎', '💤']
                                ])
                                .oneTime()
                                .resize()));
                        break;
                    }
                });
            }
        });
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
                            ctx.reply('Идём дальше. Прикрепи своё фото');
                        }
                    );
                } else {
                    ctx.reply('Используй пожалуйста только цифры');
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
                                gender: ctx.message.text.toLowerCase()
                            }
                        },
                        () => {
                            ctx.reply('Какой пол интересен?', Markup
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
                                searchGender: ctx.message.text.toLowerCase()
                            }
                        },
                        () => {
                            collectionUsers.find({
                                chat_id: ctx.chat.id
                            }).toArray(function (err, results) {
                                const user = results[0];
                                const caption = `${user.name}\n${user.age} лет\n${user.description ? user.description + '\n' : ''}Твой пол: ${user.gender.toLowerCase()}\nИнтересен: ${user.searchGender.toLowerCase()}`;

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
                            sendMenu(ctx, results[0]);
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
                            ctx.reply('Окей. Начнём с начала.\nКак тебя зовут?');
                        });
                    });
                }
            } else {
                if (ctx.message.text === 'Перезаписать мою анкету') {
                    collectionUsers.deleteOne({
                        chat_id: ctx.chat.id
                    }, () => {
                        const insertUser = {
                            chat_id: ctx.chat.id
                        };

                        collectionUsers.insertOne(insertUser, function (err, results) {
                            ctx.reply('Начнём. Как тебя зовут?');
                        });
                    });
                } else if (ctx.message.text === 'Смотреть анкеты') {
                    sendForm(ctx, results);
                } else if (ctx.message.text === '❤️') {
                    collectionUsers.find({
                        chat_id: ctx.chat.id
                    }).toArray((err, results) => {
                        if (!results[0].formNow)
                            ctx.reply('Похоже вы не начинали просмотр анкет...');
                        else {
                            
                        }
                    });
                } else if (ctx.message.text === '👎') {
                    collectionUsers.find({
                        chat_id: ctx.chat.id
                    }).toArray((err, results) => {
                        if (!results[0].formNow)
                            ctx.reply('Похоже вы не начинали просмотр анкет...');
                        else {
                            const newWathcedList = watchedList.push(results[0].formNow);

                            collectionUsers.updateOne({
                                chat_id: ctx.chat.id
                            }, {
                                $set: {
                                    watchedList: newWathcedList
                                }
                            },
                            () => {
                                sendForm(ctx, results);
                            }
                        );
                        }
                    });
                } else if (ctx.message.text === '💤') {
                    collectionUsers.find({
                        chat_id: ctx.chat.id
                    }).toArray((err, results) => {
                        if (!results[0].formNow)
                            ctx.reply('Похоже вы не начинали просмотр анкет...');
                        else {
                            collectionUsers.updateOne({
                                chat_id: ctx.chat.id
                            }, {
                                $set: {
                                    formNow: null
                                }
                            },
                            () => {
                                sendMenu(ctx, results[0]);
                            }
                        );
                            sendMenu(ctx, results[0]);
                        }
                    });
                } else {
                    ctx.reply('Неизвестная команда');
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
            } else if (results[0].age && !results[0].image_id) {
                collectionUsers.updateOne({
                        chat_id: ctx.chat.id
                    }, {
                        $set: {
                            image_id: ctx.message.photo[3].file_id
                        }
                    },
                    () => {
                        ctx.reply('Крутая фотка! Расскажешь немного о себе? (Этот шаг можно пропустить)', Markup
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