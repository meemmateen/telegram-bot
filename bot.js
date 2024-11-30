import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { MongoClient } from 'mongodb';
import TelegramBot from 'node-telegram-bot-api';

const app = express();
const port = process.env.PORT || 4000;
const uri = process.env.API_URI;
const token = process.env.BOT_TOKEN;

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Global MongoDB client connection
let client;
let clientPromise;

// Ensure MongoDB connection is reused
if (!client) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

async function getDatabase() {
    try {
        await clientPromise; // Ensure the client is connected
        const db = client.db('telegramapp');
        return db.collection('users');
    } catch (error) {
        console.error('Database connection error:', error);
        throw new Error('Failed to connect to the database');
    }
}

// Store user states (temporary memory)
const userStates = {};

// Bot command: Start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome! Type /add to save your information.');
});

// Bot command: Add user
bot.onText(/\/add/, (msg) => {
    const chatId = msg.chat.id;

    // Set the state to "awaiting_name"
    userStates[chatId] = { step: 'awaiting_name' };
    bot.sendMessage(chatId, 'Please provide your name:');
});

// Handle user input based on state
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    // Check if the user is in a specific state
    if (userStates[chatId]) {
        const state = userStates[chatId];

        if (state.step === 'awaiting_name') {
            // Save the name and move to the next step
            state.name = msg.text;
            state.step = 'awaiting_email';
            bot.sendMessage(chatId, 'Thank you! Now, please provide your email:');
        } else if (state.step === 'awaiting_email') {
            // Save the email and finish the process
            state.email = msg.text;

            // Validate email format
            if (!state.email.includes('@')) {
                return bot.sendMessage(chatId, 'Invalid email. Please provide a valid email address:');
            }

            try {
                const collection = await getDatabase();
                await collection.insertOne({ name: state.name, email: state.email });
                bot.sendMessage(chatId, `Thank you, ${state.name}! Your information has been saved.`);
            } catch (error) {
                console.error('Error saving user information:', error);
                bot.sendMessage(chatId, 'An error occurred while saving your information.');
            }

            // Clear the user's state
            delete userStates[chatId];
        }
    }
});

// Start the Express server
app.listen(port, '0.0.0.0', () => {
    console.log( `Bot is Running on ${port}`);
});
