const {
    MongoClient
} = require('mongodb');
const {
    Telegraf,
    Markup
} = require('telegraf')
const fetch = require('node-fetch');

const uri = process.env.MONGO_CONNECTION_STRING;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

console.log(process.env.NAME);

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
                if (string <= 0 || string > 100)
                    return false;
                string.toLowerCase().split('').forEach(i => {
                    if (!numbers.includes(i))
                        returnResult = false;
                });
                break;
        }
        return returnResult;
    }

    //отправить мою анкету с меню
    function sendMenu(ctx, user) {
        const caption = `${user.name}\n${user.age} лет\n${user.description ? user.description + '\n' : ''}Твой пол: ${user.gender.toLowerCase()}\nИнтересен: ${user.searchGender.toLowerCase()}`;

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

    //пишем, что твоя анкета понраивлась
    function sendLike(ctx, user, chat_id) {
        const caption = `${user.name}\n${user.age} лет${user.description ? '\n' + user.description : ''}`;

        fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${user.image_id}`)
            .then(data => data.json())
            .then(json => ctx.telegram.sendPhoto(chat_id, {
                url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`
            }, {
                caption
            }))
            .then(() => ctx.telegram.sendMessage(chat_id, 'Твоя анкета кому-то понравилась. Что скажешь?', Markup
                .keyboard([
                    ['❤️️', '👎']
                ])
                .oneTime()
                .resize()));
    }

    //показать анкету
    function sendForm(ctx, results) {
        collectionUsers.find().toArray((err, searchResults) => {
            if (searchResults.length === 0) {
                collectionUsers.updateOne({
                        chat_id: ctx.chat.id
                    }, {
                        $set: {
                            watchedList: []
                        }
                    },
                    () => {
                        ctx.reply('По твоему запросу ничего не найдено :(\nПриходи позже, я обязательно кого-нибудь найду!');
                    }
                );
            } else {
                const filterResults = searchResults.filter(i => i.liked && i.chat_id !== ctx.chat.id)
                    .filter(i => i.searchGender === results[0].gender.toLowerCase() || i.searchGender.toLowerCase() === 'любой')
                    .filter(i => i.gender === results[0].searchGender.toLowerCase() || results[0].searchGender.toLowerCase() === 'любой')
                    .filter(i => !results[0].likedList.includes(i.chat_id));

                if (filterResults.length !== 0) {
                    let searchIsComplete = false;

                    let filterResultsWatched = filterResults.filter(i => !results[0].watchedList.includes(i.chat_id));
                    if (filterResultsWatched.length === 0) {
                        filterResultsWatched = filterResults;
                        collectionUsers.updateOne({
                                chat_id: ctx.chat.id
                            }, {
                                $set: {
                                    watchedList: []
                                }
                            },
                            () => {
                                ctx.reply('Анкеты закончились! Я ещё раз покажу людей, которым ты поставил 👎')
                            }
                        );
                    }

                    filterResultsWatched.forEach(i => {
                        if (!searchIsComplete) {
                            const caption = `${i.name}\n${i.age} лет${i.description ? '\n' + i.description : ''}`;
                            searchIsComplete = true;
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
                        }
                    });
                } else
                    ctx.reply('По вашему запросу никого не найдено :(\nПриходи позже, я обязательно что-нибудь найду!');
            }
        });
    }

    //начало регистрации
    bot.command('start', (ctx) => {
        collectionUsers.find({
            chat_id: ctx.chat.id
        }).toArray((err, results) => {

            if (results.length !== 0) {
                ctx.reply('Что будем делать?\nСписок команд:\n1. Смотреть анкеты\n2. Перезаписать мою анкету', Markup
                .keyboard([
                    ['Смотреть анкеты'],
                    ['Перезаписать мою анкету']
                ])
                .oneTime()
                .resize());
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
                    ctx.reply('Используй пожалуйста только цифры.');
                }

            } else if (!results[0].image_id) {
                ctx.reply('Отправь пожалуйста фотографию');
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
                            ctx.reply('Кто интересен?', Markup
                                .keyboard([
                                    ['Мужской', 'Женский', 'Любой']
                                ])
                                .oneTime()
                                .resize());
                        }
                    );
                } else {
                    ctx.reply('Напиши пожалуйста корректный пол: Мужской/Женский');
                }

            } else if (!results[0].searchGender) {

                if (ctx.message.text === 'Мужской' || ctx.message.text === 'Женский' || ctx.message.text === 'Любой') {
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
                    ctx.reply('Напиши пожалуйста корректный пол: Мужской/Женский/Любой');
                }

            } else if (!results[0].watchedList) {
                if (ctx.message.text === 'Да') {
                    collectionUsers.updateOne({
                            chat_id: ctx.chat.id
                        }, {
                            $set: {
                                watchedList: [],
                                liked: [],
                                likedList: []
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
                if (ctx.message.text.toLowerCase() === 'перезаписать мою анкету') {
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
                } else if (ctx.message.text.toLowerCase() === 'смотреть анкеты') {
                    sendForm(ctx, results);
                } else if (ctx.message.text === '❤️️') {
                    collectionUsers.find({
                        chat_id: ctx.chat.id
                    }).toArray((err, results) => {
                        //проверяем, лайкнул ли нас кто-то
                        if (results[0].liked.length !== 0) {
                            const liker = results[0].liked[0];
                            let newLiked = results[0].liked;
                            newLiked.splice(0, 1);

                            collectionUsers.updateOne({
                                    chat_id: results[0].chat_id
                                }, {
                                    $set: {
                                        liked: newLiked
                                    }
                                },
                                () => {
                                    collectionUsers.find({
                                        chat_id: results[0].chat_id
                                    }).toArray((err, updateResults) => {
                                        ctx.telegram.getChat(liker)
                                            .then(data => ctx.reply(`Отлично! Хорошей беседы :)\nАккаунт собеседника: @${data.username}`));

                                        ctx.telegram.sendMessage(liker, `Хэй! Твой собеседник не прочь познакомиться! :)\nАккаунт собеседника: @${ctx.chat.username}`);
                                        if (newLiked.length !== 0) {
                                            collectionUsers.find({
                                                chat_id: newLiked[0]
                                            }).toArray((err, users) => {
                                                sendLike(ctx, users[0], ctx.chat.id);
                                            });
                                        } else {
                                            sendMenu(ctx, updateResults[0]);
                                        }
                                    });
                                }
                            );
                        } else if (!results[0].formNow)
                            ctx.reply('Похоже вы не начинали просмотр анкет...');
                        else {
                            collectionUsers.find({
                                chat_id: results[0].formNow
                            }).toArray((err, likedResult) => {
                                let newLiked = likedResult[0].liked;
                                newLiked.push(ctx.chat.id);

                                collectionUsers.updateOne({
                                        chat_id: results[0].formNow
                                    }, {
                                        $set: {
                                            liked: newLiked
                                        }
                                    },
                                    (err, updateLiked) => {
                                        let newWathcedList = results[0].watchedList;
                                        newWathcedList.push(results[0].formNow);

                                        let newLikedList = results[0].likedList;
                                        newLikedList.push(results[0].formNow);

                                        collectionUsers.updateOne({
                                                chat_id: results[0].chat_id
                                            }, {
                                                $set: {
                                                    watchedList: newWathcedList,
                                                    likedList: newLikedList
                                                }
                                            },
                                            () => {
                                                collectionUsers.find({
                                                    chat_id: results[0].chat_id
                                                }).toArray((err, updateResults) => {
                                                    if(newLiked.length === 1)
                                                        sendLike(ctx, updateResults[0], results[0].formNow);
                                                    sendForm(ctx, updateResults);
                                                });
                                            }
                                        );
                                    }
                                );
                            });
                        }
                    });
                } else if (ctx.message.text === '👎') {
                    collectionUsers.find({
                        chat_id: ctx.chat.id
                    }).toArray((err, results) => {
                        if (results[0].liked.length !== 0) {
                            let newLiked = results[0].liked;
                            newLiked.splice(0, 1);

                            collectionUsers.updateOne({
                                    chat_id: results[0].chat_id
                                }, {
                                    $set: {
                                        liked: newLiked
                                    }
                                },
                                () => {
                                    collectionUsers.find({
                                        chat_id: results[0].chat_id
                                    }).toArray((err, updateResults) => {
                                        if (newLiked.length !== 0) {
                                            collectionUsers.find({
                                                chat_id: newLiked[0]
                                            }).toArray((err, users) => {
                                                sendLike(ctx, users[0], ctx.chat.id);
                                            });
                                        } else {
                                            sendMenu(ctx, updateResults[0]);
                                        }
                                    });
                                }
                            );
                        } else if (!results[0].formNow)
                            ctx.reply('Похоже вы не начинали просмотр анкет...');
                        else {
                            let newWathcedList = results[0].watchedList;
                            newWathcedList.push(results[0].formNow);

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
                                () => {}
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
                let photo = null;

                for(let j = 0; j < 4; j++)
                   photo = ctx.message.photo[j] ? ctx.message.photo[j].file_id : photo;

                if(photo) {
                collectionUsers.updateOne({
                        chat_id: ctx.chat.id
                    }, {
                        $set: {
                            image_id: photo
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
              } else
                 ctx.reply("Извините, что-то полшло не так, попробуйте ещё раз!");
            } else {
                ctx.reply('Фото классное, но оно мне сейчас не нужно');
            }
        });
    });

    //защита от дебилов
    bot.on('video', (ctx) => {
        ctx.reply('Крутое видео 🗿');
    });

    bot.on('sticker', (ctx) => {
        ctx.reply('Крутой стикер 🗿');
    });

    bot.on('audio', (ctx) => {
        ctx.reply('Круто 🗿');
    });

    bot.on('location', (ctx) => {
        ctx.reply('Круто 🗿');
    });

    bot.on('document', (ctx) => {
        ctx.reply('Круто 🗿\n Если что, фотографию нужно отправить фотографией, а не файлом');
    });

    bot.on('poll', (ctx) => {
        ctx.reply('За 1 🗿');
    });

    bot.on('contact', (ctx) => {
        ctx.reply('Завтра позвоню 🗿');
    });

    bot.launch({
        webhook: {
          domain: 'https://sirius-tinder.herokuapp.com/',
          port: process.env.PORT
        }
      })
});

      // Enable graceful stop
      process.once('SIGINT', () => bot.stop('SIGINT'))
      process.once('SIGTERM', () => bot.stop('SIGTERM'))
