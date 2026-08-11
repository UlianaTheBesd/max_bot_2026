import { Bot, Keyboard } from '@maxhub/max-bot-api';
import 'dotenv/config'

// ДЛЯ ЗАПУСКА. node max_bot_2026.ts

// Хранилище состояний пользователей JSON ? (txt может быть сделать ?) ).
const userStates = new Map<string, 'new' | 'active'>(); // ПЕРЕНЕСТИ В JSON.

const bot = new Bot(process.env.BOT_TOKEN!);

// Инлайн-кнопка для новых пользоваетелей
// (т.к. почему-то "Начать" не отсылает в чат /start).
const newestKeyboard = Keyboard.inlineKeyboard([
  [Keyboard.button.callback("LET's go! 💥", 'start_activation')],
]);

// Инлайн-меню для активных пользователей.
const mainKeyboard1 = Keyboard.inlineKeyboard([
  [Keyboard.button.callback('✍️ Начать заполнять анкету', 'menu_main')],
  [Keyboard.button.callback('↩️ Сброс бота', 'reset_new')],
]);

// ОБРАБОТКА НА NEW / ACTIVE ПОЛЬЗОВАТЕЛЯ.
bot.on('message_created', async (ctx, next) => {
  const userId = ctx.botInfo?.user_id;
  if (!userId) return next(); // что это значит?
  
  const userState = userStates.get(String(userId)); // почему здесь требовался именно String, а не Number?
  
  if (!userState || userState === 'new') {
    userStates.set(String(userId), 'new');
    return ctx.reply(`Здравствуйте!
Нажмите кнопку для начала работы бота:`, {
      attachments: [newestKeyboard],
    });
  }
  
  return next();
});

// Команда для сброса пользователя в состояние new.
bot.command('reset', (ctx) => {
  const userId = ctx.botInfo?.user_id;
  if (!userId) return ctx.reply('Не удалось определить ваш ID'); // Зачем отправлять это сообщение?.. типа просто "возникла ошибка"?

  userStates.set(String(userId), 'new'); 
  
  // Или полностью стираем из памяти: userStates.delete(String(userId)).

  return ctx.reply('🔄 Ваше состояние сброшено! Отправьте любое сообщение, чтобы увидеть начальное меню.');
});

bot.action('start_activation', async (ctx) => {
  const userId = ctx.botInfo?.user_id;
  const username = ctx.botInfo?.name || 'пользователь';
  if (!userId) return; // а куда он возвращает нас? в меню?

  userStates.set(String(userId), 'active');
  
  // Удаление старого приветственого сообщения, чтобы не засорять чат.
  await ctx.deleteMessage(); // встроенная функция?
  
  return ctx.reply(`Здравствуйте, ${username}!

Мы рады приветствовать вас в школе иностранных языков "LET"!
Записаться к нам на занятие вы можете заполнив эту форму.
Мы с вами обязательно свяжемся.`,
{attachments: [mainKeyboard1],});
});

bot.action('menu_main', (ctx) => {
  return ctx.reply('Вы в главном меню!', { attachments: [mainKeyboard1] });
});

bot.action('reset_new', (ctx) => {
  const userId = ctx.botInfo?.user_id;
  if (!userId) return ctx.reply('Не удалось определить ваш ID'); // Зачем отправлять это сообщение?.. типа просто "возникла ошибка"?

  userStates.set(String(userId), 'new'); 
  
  // Или полностью стираем из памяти: userStates.delete(String(userId)).

  return ctx.reply('🔄 Ваше состояние сброшено! Отправьте любое сообщение, чтобы увидеть начлаьное меню.');
});

// ОБРАБОТКА НЕПРАВИЛЬНОГО ТЕКСТА ОТ ACTIVE ПОЛЬЗОВАТЕЛЯ.
bot.on('message_created', (ctx, next) => {
  const userId = ctx.botInfo?.user_id;
  if (!userId) return next();
  
  const userState = userStates.get(String(userId));
  if (userState === 'active') {
    return ctx.reply('Извините, не могу распознать этот текст. Пожалуйста, уточните ваш запрос.', {
      attachments: [mainKeyboard1],
    });
  }
  return next();
});

bot.start();

