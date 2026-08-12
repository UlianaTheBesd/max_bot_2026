import { Bot, Keyboard } from '@maxhub/max-bot-api';
import 'dotenv/config'

// ДЛЯ ЗАПУСКА. node max_bot_2026.ts

const bot = new Bot(process.env.BOT_TOKEN!);
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

// Функция для отправки сообщения админу (API Max).
async function sendToAdmin(text: string, attachments?: any[]) {
  const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
  
  if (!ADMIN_USER_ID) {
    console.error('ADMIN_USER_ID не указан в .env файле');
    return false;
  }
  
  try {
    const response = await fetch(`https://platform-api2.max.ru/messages?user_id=${ADMIN_USER_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `${process.env.BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        attachments: attachments || [],
      }),
    });
    
    if (!response.ok) {
      console.error('Ошибка отправки админу:', await response.text());
      return false;
    }
    
    console.log('Анкета успешно отправлена админу');
    return true;
  } catch (error) {
    console.error('Ошибка при отправке админу:', error);
    return false;
  }
}

// Хранилище состояний пользователей JSON ? (txt может быть сделать ?) ).
const userStates = new Map<string, 
  'new' | 
  'active' | 
  'waiting_for_name' | 
  'waiting_for_tele' | 
  'waiting_for_school' | 
  'waiting_for_shift' | 
  'waiting_for_YofSt' | 
  'waiting_for_grade' | 
  'checking_data' |
  'editing_name' |
  'editing_tele' |
  'editing_school' |
  'editing_shift' |
  'editing_YofSt' |
  'editing_grade' |
  'admin'
>(); // JSON!!! (Хотя... если они потом все кнопки убирают из чата..?.. Добавить ее одну? (типа, создать новую анкету?))

// Хранилище ответов анкет.
const userAnswers = new Map<string, { studentName?: string; studentTele?: string; studentSchool?: string; studentShift?: string; studentYearOfSt?: string; studentGrade?: string}>();

// Инлайн-кнопка для новых пользователей.
// (т.к. почему-то "Начать" не отсылает в чат /start).
const newestKeyboard = Keyboard.inlineKeyboard([
  [Keyboard.button.callback("LET's go! 💥", 'start_activation')],
]);

// Инлайн-меню для активных пользователей.
const mainKeyboard1 = Keyboard.inlineKeyboard([
  [Keyboard.button.callback('✍️ Начать заполнять анкету', 'menu_main')],
  [Keyboard.button.callback('↩️ Сброс бота', 'reset_new')],
]);

// Инлайн-меню для подтверждения отправки анкеты.
const confirmKeyboard = Keyboard.inlineKeyboard([
  [Keyboard.button.callback('✅ Всё верно, отправить', 'confirm_form')],
  [Keyboard.button.callback('↪️ Изменить', 'change_form')],
  [Keyboard.button.callback('✖️ Отменить заполнение', 'reset_form')],
]);

// Инлайн-меню для выбора предмета для редактирования.
const editKeyboard = Keyboard.inlineKeyboard([
  [Keyboard.button.callback('1. Имя и фамилия', 'edit_name')],
  [Keyboard.button.callback('2. Телефон', 'edit_tele')],
  [Keyboard.button.callback('3. Школа и класс', 'edit_school')],
  [Keyboard.button.callback('4. Смена', 'edit_shift')],
  [Keyboard.button.callback('5. Обучение в LET', 'edit_year')],
  [Keyboard.button.callback('6. Отметка', 'edit_grade')],
  [Keyboard.button.callback('↪️ Назад к проверке', 'back_to_check')],
]);


// Команда для сброса в состояние new.
// (не для пользователей!).
bot.command('reset', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return ctx.reply('Не удалось определить ваш ID');

  userStates.set(String(userId), 'new'); 

  await ctx.deleteMessage();
  
  // Или полностью стираем из памяти: userStates.delete(String(userId)).

  return ctx.reply('🔄 Ваше состояние сброшено! Отправьте любое сообщение, чтобы увидеть начальное меню.');
});


// ПРИВЕТСТВЕННОЕ МЕНЮ ПОСЛЕ 'АКТИВАЦИИ' ПОЛЬЗОВАТЕЛЯ.
// (new -> active).
bot.action('start_activation', async (ctx) => {
  const userId = ctx.chatId;
  const username = ctx.user.name || 'пользователь';
  if (!userId) return;

  userStates.set(String(userId), 'active');
  
  // Удаление старого приветственого сообщения, чтобы не засорять чат.
  await ctx.deleteMessage();
  
  return ctx.reply(`Здравствуйте, ${username}!

Мы рады приветствовать вас в школе иностранных языков "LET"!
Записаться к нам на занятие вы можете заполнив эту форму.
Мы с вами обязательно свяжемся.`,
{attachments: [mainKeyboard1],});
});


// НАЧАЛО ВОПРОСОВ.
bot.action('menu_main', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  userStates.set(String(userId), 'waiting_for_name');

  await ctx.deleteMessage();

  return ctx.reply('Пожалуйста, введите фамилию и имя ребёнка.');
});

// Команда /reset_new (из меню пользователя).
bot.action('reset_new', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return ctx.reply('Не удалось определить ваш ID');

  userStates.set(String(userId), 'new'); 

  await ctx.deleteMessage();
  
  // Или полностью стираем из памяти: userStates.delete(String(userId)).

  return ctx.reply('🔄 Ваше состояние сброшено! Отправьте любое сообщение, чтобы увидеть начальное меню.');
});


// ОБРАБОТКА ПРАВИЛЬНОГО ТЕКСТА ОТ РАЗНЫХ СОСТОЯНИЙ ПОЛЬЗОВАТЕЛЯ.
bot.on('message_created', (ctx, next) => {
  const userId = ctx.chatId;
  if (!userId) return next();

  const userState = userStates.get(String(userId));
  const userText = ctx.message?.body?.text?.trim();

  // ОБРАБОТКА НА NEW / ACTIVE ПОЛЬЗОВАТЕЛЯ.
  // (если пользователь new - будет предложено НЕ основное меню).
  if (!userState || userState === 'new') {
    userStates.set(String(userId), 'new');
    return ctx.reply(`Здравствуйте!
Нажмите кнопку для начала работы бота:`, {
      attachments: [newestKeyboard],
    });
  }

  // ОБРАБОТКА НА ADMIN.
  if (String(userId) == String(ADMIN_USER_ID)) {
    userStates.set(String(userId), 'admin');
    return ctx.reply(`Здравствуйте!
Вы вошли в режим "Админ" (🤖💥⚡⚡).

Новые заявки от пользователей будут приходить в этот чат 😊`, {
      attachments: [newestKeyboard],
    });
  }

  // ОБРАБОТКА ОСНОВНЫХ СОСТОЯНИЙ.
  // ВОПРОС 1: ФИ.
  if (userState === 'waiting_for_name') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте имя текстом.');
    }

    // Сохранение данных анкеты.
    userAnswers.set(String(userId), { studentName: userText });

    // Смена состояния бота.
    userStates.set(String(userId), 'waiting_for_tele');

    // Следующий вопрос.
    return ctx.reply(`"${userText}" ✅
\nВведите номер телефона родителя в формате +79XXXXXXXXX.`);
  }

  // ВОПРОС 2: Телефон.
  if (userState === 'waiting_for_tele') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте номер телефона текстом.');
    }

    const registery = /^\+79\d{9}$/; // регулярка для проверки формата +79XXXXXXXXX.

    if (!registery.test(userText)) {
      return ctx.reply('Кажется, номер телефона введён неверно. Пожалуйста, попробуйте ещё раз в формате +79XXXXXXXXX.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentTele = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'waiting_for_school');

    return ctx.reply(`"${userText}" ✅
\nПожалуйста, укажите номер школы и класс с буквой (например: 44 5А).`);
  }

  // ВОПРОС 3: Школа&буква.
  if (userState === 'waiting_for_school') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте номер школы и класс текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentSchool = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'waiting_for_shift');

    return ctx.reply(`"${userText}" ✅
\nПожалуйста, укажите смену ребёнка в школе.`);
  }

  // ВОПРОС 4: Смена.
  if (userState === 'waiting_for_shift') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте данные о смене текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentShift = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'waiting_for_YofSt');

    return ctx.reply(`"${userText}" ✅
\nОбучается ли Ваш ребёнок в нашей школе LET?
(если да, напишите, сколько лет длится обучение).`);
  }

  // ВОПРОС 5: Год в LET.
  if (userState === 'waiting_for_YofSt') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте информацию об обучении текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentYearOfSt = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'waiting_for_grade');

    return ctx.reply(`"${userText}" ✅
\nУточните, какая отметка у Вашего ребёнка по английскому языку в школе?`);
  }

  // ВОПРОС 6: Оценка в школе + ФИНАЛ.
  if (userState === 'waiting_for_grade') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте отметку текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentGrade = userText;
    userAnswers.set(String(userId), currentData);
    
    userStates.set(String(userId), 'checking_data');

    // Итоговые данные анкеты.
    const finalName = currentData.studentName;
    const finalTele = currentData.studentTele;
    const finalSchool = currentData.studentSchool;
    const finalShift = currentData.studentShift;
    const finalYearOfSt = currentData.studentYearOfSt;
    const finalGrade = currentData.studentGrade;

    return ctx.reply(`Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${finalName}
2. Номер телефона родителя: ${finalTele}
3. Номер школы и класс: ${finalSchool}
4. Смена в школе: ${finalShift}
5. Год обучения в LET: ${finalYearOfSt}
6. Отметка по английскому: ${finalGrade}
`, { attachments: [confirmKeyboard]});
    }

  // ОБРАБОТКА EDITING СОСТОЯНИЙ.
  // [1 edit].
  if (userState === 'editing_name') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте имя текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentName = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'checking_data');

    return ctx.reply(`"${userText}" ✅

Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${currentData.studentName}
2. Номер телефона родителя: ${currentData.studentTele}
3. Номер школы и класс: ${currentData.studentSchool}
4. Смена в школе: ${currentData.studentShift}
5. Год обучения в LET: ${currentData.studentYearOfSt}
6. Отметка по английскому: ${currentData.studentGrade}
`, { attachments: [confirmKeyboard]});
  }

  // [2 edit].
  if (userState === 'editing_tele') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте номер телефона текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentTele = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'checking_data');

    return ctx.reply(`"${userText}" ✅

Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${currentData.studentName}
2. Номер телефона родителя: ${currentData.studentTele}
3. Номер школы и класс: ${currentData.studentSchool}
4. Смена в школе: ${currentData.studentShift}
5. Год обучения в LET: ${currentData.studentYearOfSt}
6. Отметка по английскому: ${currentData.studentGrade}
`, { attachments: [confirmKeyboard]});
  }

  // [3 edit].
  if (userState === 'editing_school') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте номер школы и класс текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentSchool = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'checking_data');

    return ctx.reply(`"${userText}" ✅

Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${currentData.studentName}
2. Номер телефона родителя: ${currentData.studentTele}
3. Номер школы и класс: ${currentData.studentSchool}
4. Смена в школе: ${currentData.studentShift}
5. Год обучения в LET: ${currentData.studentYearOfSt}
6. Отметка по английскому: ${currentData.studentGrade}
`, { attachments: [confirmKeyboard]});
  }

  // [4 edit].
  if (userState === 'editing_shift') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте данные о смене текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentShift = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'checking_data');

    return ctx.reply(`"${userText}" ✅

Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${currentData.studentName}
2. Номер телефона родителя: ${currentData.studentTele}
3. Номер школы и класс: ${currentData.studentSchool}
4. Смена в школе: ${currentData.studentShift}
5. Год обучения в LET: ${currentData.studentYearOfSt}
6. Отметка по английскому: ${currentData.studentGrade}
`, { attachments: [confirmKeyboard]});
  }

  // [5 edit].
  if (userState === 'editing_YofSt') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте информацию об обучении текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentYearOfSt = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'checking_data');

    return ctx.reply(`"${userText}" ✅

Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${currentData.studentName}
2. Номер телефона родителя: ${currentData.studentTele}
3. Номер школы и класс: ${currentData.studentSchool}
4. Смена в школе: ${currentData.studentShift}
5. Год обучения в LET: ${currentData.studentYearOfSt}
6. Отметка по английскому: ${currentData.studentGrade}
`, { attachments: [confirmKeyboard]});
  }

  // [5 edit].
  if (userState === 'editing_grade') {
    if (!userText) {
      return ctx.reply('Пожалуйста, отправьте отметку текстом.');
    }

    const currentData = userAnswers.get(String(userId)) || {};
    currentData.studentGrade = userText;
    userAnswers.set(String(userId), currentData);

    userStates.set(String(userId), 'checking_data');

    return ctx.reply(`"${userText}" ✅

Всё ли указано верно?
\n1. Фамилия и имя ребёнка: ${currentData.studentName}
2. Номер телефона родителя: ${currentData.studentTele}
3. Номер школы и класс: ${currentData.studentSchool}
4. Смена в школе: ${currentData.studentShift}
5. Год обучения в LET: ${currentData.studentYearOfSt}
6. Отметка по английскому: ${currentData.studentGrade}
`, { attachments: [confirmKeyboard]});
  }

  // ОБРАБОТКА НЕПРАВИЛЬНОГО ТЕКСТА ОТ ACTIVE ПОЛЬЗОВАТЕЛЯ.
  if (userState === 'active') {
    return ctx.reply('Извините, не могу распознать этот текст. Пожалуйста, уточните ваш запрос.', {
      attachments: [mainKeyboard1],
    });
  }

  return next();
});


// РЕАКЦИИ НА ИНЛАЙН-КЛАВИАТУРУ CONFIRM KEYBOARD (3 элемента).
// [1]
bot.action('confirm_form', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  const finalData = userAnswers.get(String(userId));
  
  if (!finalData) {
    return ctx.reply('Ошибка: данные анкеты не найдены...');
  }
  
  await ctx.deleteMessage(); // ??? убрать?
  
  // Сообщение для ADMIN.
  const adminMessage1 = `📨 НОВАЯ ЗАЯВКА!

Пользователь: ${ctx.user.name || 'Неизвестный'}
ID пользователя: ${userId}

1. Фамилия и имя ребёнка: ${finalData.studentName}
2. Телефон родителя: ${finalData.studentTele}
3. Школа и класс: ${finalData.studentSchool}
4. Смена в школе: ${finalData.studentShift}
5. Год обучения в LET: ${finalData.studentYearOfSt}
6. Отметка по англ. (в шк.): ${finalData.studentGrade}

(Дата отправки заявки: ${new Date().toLocaleString('ru-RU')})
`
  const sent = await sendToAdmin(adminMessage1);
  
  userAnswers.delete(String(userId));
  userStates.set(String(userId), 'active');

  if (sent) {
    return ctx.reply('⭐ Спасибо! Ваша заявка успешно принята.\n\nНаш администратор свяжется с вами в ближайшее время!', {
      attachments: [mainKeyboard1],
    });
  } else {
    return ctx.reply('Извините..\nВозникла техническая проблема с отправкой. Пожалуйста, заполните анкету заново.', {
      attachments: [mainKeyboard1],
    });
  }
});

// [2]
bot.action('change_form', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  const finalData = userAnswers.get(String(userId));

  if (!finalData) {
    return ctx.reply('Ошибка: данные анкеты не найдены...');
  }

  await ctx.deleteMessage(); // УДАЛИТЬ?

  return ctx.reply(`📝 Выберите поле для редактирования:

1. Фамилия и имя ребёнка: ${finalData.studentName}
2. Телефон родителя: ${finalData.studentTele}
3. Школа и класс: ${finalData.studentSchool}
4. Смена в школе: ${finalData.studentShift}
5. Год обучения в LET: ${finalData.studentYearOfSt}
6. Отметка по англ. (в шк.): ${finalData.studentGrade}
    `, {attachments: [editKeyboard]})

});

// [3]
bot.action('reset_form', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userAnswers.delete(String(userId));
  userStates.set(String(userId), 'waiting_for_name');
  
  await ctx.deleteMessage(); // УДАЛИТЬ?
  
  return ctx.reply('🔄 Начинаем заполнение заново.\n\nПожалуйста, введите фамилию и имя ребёнка.');
});

// Команда back_to_check.
bot.action('back_to_check', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  const finalData = userAnswers.get(String(userId));
  
  if (!finalData) {
    return ctx.reply('Данные анкеты не найдены. Начните заполнение заново.');
  }
  
  userStates.set(String(userId), 'checking_data');
  
  await ctx.deleteMessage();

  return ctx.reply(`Проверьте, всё ли указано верно?:

1. Фамилия и имя ребёнка: ${finalData.studentName}
2. Телефон родителя: ${finalData.studentTele}
3. Школа и класс: ${finalData.studentSchool}
4. Смена в школе: ${finalData.studentShift}
5. Год обучения в LET: ${finalData.studentYearOfSt}
6. Отметка по англ. (в шк.): ${finalData.studentGrade}
    `, {attachments: [confirmKeyboard]})
})

// РЕДАКТИРОВАНИЕ ПРЕДМЕТОВ.
bot.action('edit_name', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userStates.set(String(userId), 'editing_name');
  
  await ctx.deleteMessage();
  
  return ctx.reply('Введите новые фамилию и имя ребёнка:');
});

bot.action('edit_tele', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userStates.set(String(userId), 'editing_tele');
  
  await ctx.deleteMessage();
  
  return ctx.reply('Введите новый номер телефона в формате +79XXXXXXXXX:');
});

bot.action('edit_school', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userStates.set(String(userId), 'editing_school');
  
  await ctx.deleteMessage();
  
  return ctx.reply('Введите новые номер школы и класс с буквой:');
});

bot.action('edit_shift', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userStates.set(String(userId), 'editing_shift');
  
  await ctx.deleteMessage();
  
  return ctx.reply('Введите новую смену в школе:');
});

bot.action('edit_year', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userStates.set(String(userId), 'editing_YofSt');
  
  await ctx.deleteMessage();
  
  return ctx.reply('Введите новый год обучения в LET:');
});

bot.action('edit_grade', async (ctx) => {
  const userId = ctx.chatId;
  if (!userId) return;
  
  userStates.set(String(userId), 'editing_grade');
  
  await ctx.deleteMessage();
  
  return ctx.reply('Введите новую оценку:');
});

bot.start();