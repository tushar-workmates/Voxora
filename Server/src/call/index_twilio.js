import { Client } from "plivo";
import WebSocket, { WebSocketServer } from 'ws';
import express from "express";
import http from 'http';
import { SessionUpdate } from "./final_seasonUpdate.js";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from 'mongodb';
import * as chrono from "chrono-node";
import OpenAI from 'openai';
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors({
    origin: ['http://localhost:8081', 'http://localhost:5173', 'http://localhost:3000', 'https://eceafd0183fa.ngrok-free.app '],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const PORT = process.env.PORT || 5000;

const { 
    OPENAI_API_KEY, 
    MONGODB_URI, 
    PLIVO_AUTH_ID, 
    PLIVO_AUTH_TOKEN, 
    PLIVO_NUMBER, 
    NGROK_URL 
} = process.env;

const plivoClient = new Client(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN);

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// Store active calls temporarily to track phone numbers
const activeCalls = new Map();

// MongoDB connection setup
let mongoClient;
let db;
let appointmentsCollection;
let callTranscriptsCollection;

// IST Timezone utilities
const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30

// Helper function to get current IST date
function getCurrentISTDate() {
    const now = new Date();
    return new Date(now.getTime() + IST_OFFSET);
}

// Helper function to convert date to IST
function toIST(date) {
    return new Date(date.getTime() + IST_OFFSET);
}

// Helper function to format date in IST for display
function formatISTDate(date) {
    const istDate = toIST(date);
    return istDate.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper function to get IST date in YYYY-MM-DD format
function getISTDateString(date) {
    const istDate = toIST(date);
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize MongoDB connection
async function initializeMongoDB() {
    if (!MONGODB_URI) {
        console.warn('MongoDB URI not found. Database storage will be disabled.');
        return;
    }

    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        db = mongoClient.db('voxora');
        appointmentsCollection = db.collection('appointments');
        callTranscriptsCollection = db.collection('call_transcripts');
        
        // Create indexes for appointments collection
        try {
            await appointmentsCollection.createIndex({ phoneNumber: 1 });
            await appointmentsCollection.createIndex({ createdAt: 1 });
            await appointmentsCollection.createIndex({ date: 1 });
        } catch (error) {
            if (error.code !== 85) console.warn('appointments index:', error.message);
        }
        
        // Create indexes for call_transcripts with error handling
        try {
            await callTranscriptsCollection.createIndex({ callSid: 1 }, { unique: true });
        } catch (error) {
            if (error.code !== 85) console.warn('callSid index:', error.message);
        }
        
        try {
            await callTranscriptsCollection.createIndex({ phoneNumber: 1 });
        } catch (error) {
            if (error.code !== 85) console.warn('phoneNumber index:', error.message);
        }
        
        try {
            // Drop existing createdAt index if it exists without TTL
            const indexes = await callTranscriptsCollection.indexes();
            const existingIndex = indexes.find(idx => idx.name === 'createdAt_1');
            if (existingIndex && !existingIndex.expireAfterSeconds) {
                await callTranscriptsCollection.dropIndex('createdAt_1');
            }
            
            await callTranscriptsCollection.createIndex(
                { createdAt: 1 }, 
                { expireAfterSeconds: 24 * 60 * 60 }
            );
        } catch (error) {
            if (error.code !== 85) console.warn('TTL index:', error.message);
        }
        
        console.log('MongoDB connected successfully to voxora database');
        console.log('Collections initialized: appointments, call_transcripts');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
    }
}

// Transcript helper functions
async function createTranscript(callSid, phoneNumber) {
    if (!callTranscriptsCollection) return null;
    
    try {
        const transcript = {
            callSid,
            phoneNumber,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            conversation: [],
            summary: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        await callTranscriptsCollection.insertOne(transcript);
        console.log(`Created transcript for call ${callSid}`);
        return transcript;
    } catch (error) {
        console.error('Error creating transcript:', error);
        return null;
    }
}

async function addConversationEntry(callSid, entry) {
    if (!callTranscriptsCollection) return;
    
    try {
        await callTranscriptsCollection.updateOne(
            { callSid },
            { 
                $push: { conversation: entry },
                $set: { updatedAt: new Date() }
            }
        );
    } catch (error) {
        console.error('Error adding conversation entry:', error);
    }
}

async function updateCallEnd(callSid) {
    if (!callTranscriptsCollection) return;
    
    try {
        const transcript = await callTranscriptsCollection.findOne({ callSid });
        if (transcript) {
            const endTime = Date.now();
            const duration = endTime - transcript.startTime;
            
            await callTranscriptsCollection.updateOne(
                { callSid },
                { 
                    $set: { 
                        endTime,
                        duration,
                        updatedAt: new Date()
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error updating call end:', error);
    }
}

async function generateAutoSummary(callSid) {
    console.log(`🤖 AUTO-SUMMARY: Starting generation for call ${callSid}`);
    
    if (!callTranscriptsCollection) {
        console.log('❌ AUTO-SUMMARY: No database collection available');
        return;
    }
    
    try {
        const transcript = await callTranscriptsCollection.findOne({ callSid });
        
        if (!transcript) {
            console.log(`❌ AUTO-SUMMARY: No transcript found for ${callSid}`);
            return;
        }
        
        if (!transcript.conversation || transcript.conversation.length === 0) {
            console.log(`❌ AUTO-SUMMARY: No conversation found for ${callSid}`);
            return;
        }

        console.log(`✅ AUTO-SUMMARY: Found transcript with ${transcript.conversation.length} messages for ${callSid}`);

        // Prepare conversation text for OpenAI
        const conversationText = transcript.conversation
            .map(entry => `${entry.type === 'user' ? 'Caller' : 'Assistant'}: ${entry.text}`)
            .join('\n');

        let summaryText;
        
        try {
            console.log(`🔄 AUTO-SUMMARY: Calling OpenAI API for ${callSid}`);
            
            // Call OpenAI API for summary
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a concise call summarizer. Provide a brief 2-3 paragraph summary covering: main purpose, key discussion points, and outcome." 
                    },
                    { 
                        role: "user", 
                        content: `Provide a concise summary of this call:\n\n${conversationText}` 
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            summaryText = completion.choices[0].message.content;
            console.log(`✅ AUTO-SUMMARY: OpenAI API successful for ${callSid}`);
        } catch (openaiError) {
            console.log(`⚠️ AUTO-SUMMARY: OpenAI error for ${callSid}:`, openaiError.message);
            summaryText = createFallbackSummary(transcript);
            console.log(`✅ AUTO-SUMMARY: Using fallback summary for ${callSid}`);
        }

        // Store the summary in MongoDB
        const summaryData = {
            text: summaryText,
            style: 'auto-generated',
            generatedAt: Date.now(),
            generatedAtIST: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            model: "gpt-3.5-turbo"
        };

        await callTranscriptsCollection.updateOne(
            { callSid },
            { 
                $set: { 
                    summary: summaryData,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`🎉 AUTO-SUMMARY: Successfully generated and stored for ${callSid}`);
        
    } catch (error) {
        console.error(`❌ AUTO-SUMMARY: Error for ${callSid}:`, error);
    }
}

async function getTranscript(callSid) {
    if (!callTranscriptsCollection) return null;
    
    try {
        return await callTranscriptsCollection.findOne({ callSid });
    } catch (error) {
        console.error('Error getting transcript:', error);
        return null;
    }
}

// Store appointment in MongoDB
async function storeAppointmentInMongoDB(appointmentData) {
    if (!appointmentsCollection) {
        console.warn('MongoDB not configured. Appointment not stored.');
        return { success: false, message: 'Database not configured' };
    }

    try {
        // Validate date is in the future (using IST)
        const appointmentDate = new Date(appointmentData.date + 'T00:00:00+05:30'); // Treat as IST date
        const todayIST = getCurrentISTDate();
        todayIST.setHours(0, 0, 0, 0);
        
        console.log('IST Date Validation:');
        console.log('Appointment Date (IST):', appointmentDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Today IST:', todayIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Is future date?', appointmentDate >= todayIST);

        if (appointmentDate < todayIST) {
            return { 
                success: false, 
                message: 'Appointment date must be in the future' 
            };
        }

        const appointmentRecord = {
            ...appointmentData,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            timezone: 'IST'
        };

        const result = await appointmentsCollection.insertOne(appointmentRecord);
        
        console.log('Appointment stored in MongoDB with ID:', result.insertedId);
        return { 
            success: true, 
            message: 'Appointment stored successfully',
            appointmentId: result.insertedId 
        };
    } catch (error) {
        console.error('Error storing appointment in MongoDB:', error);
        return { 
            success: false, 
            message: 'Failed to store appointment in database' 
        };
    }
}

// Helper function for fallback summary
function createFallbackSummary(transcript) {
    if (!transcript.conversation || transcript.conversation.length === 0) {
        return "No conversation content available for summary.";
    }

    const userMessages = transcript.conversation.filter(m => m.type === 'user').map(m => m.text);
    const aiMessages = transcript.conversation.filter(m => m.type === 'ai').map(m => m.text);
    
    const duration = transcript.duration ? Math.round(transcript.duration / 1000) : 'Unknown';
    
    return `Call Summary (Auto-generated):
    
Call Duration: ${duration} seconds
Total Messages: ${transcript.conversation.length} (${userMessages.length} from caller, ${aiMessages.length} from assistant)

Call Overview: This was a customer service conversation between a caller and AWS solutions assistant.

Key Caller Points: ${userMessages.slice(0, 3).map(msg => `"${msg.substring(0, 100)}..."`).join('; ')}

Assistant Responses: Provided professional AWS guidance and support.

Status: Conversation completed ${transcript.conversation.length >= 4 ? 'with meaningful exchange' : 'with brief interaction'}.`;
}

// Tools for function calling
const TOOLS = {
    book_appointment: async ({ name, date, purpose }) => {
        console.log("=== APPOINTMENT BOOKING STARTED ===");
        console.log("Current IST:", getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log("Input details:", { name, date, purpose });

        // Validate required fields
        if (!name || !date || !purpose) {
            return "Missing required appointment details. Please provide name, date, and purpose.";
        }

        // Parse natural language date using chrono in IST context
        const nowIST = getCurrentISTDate();
        let appointmentDate = chrono.parseDate(date, nowIST, { forwardDate: true });
        
        if (!appointmentDate) {
            return "I couldn't understand the date. Please say something like 'tomorrow' or '26 October 2025'.";
        }

        // Convert to IST for accurate comparison
        const appointmentDateIST = toIST(appointmentDate);
        appointmentDateIST.setHours(0, 0, 0, 0);

        const todayIST = getCurrentISTDate();
        todayIST.setHours(0, 0, 0, 0);

        // Debug logging in IST
        console.log('=== IST DATE COMPARISON ===');
        console.log('Input date string:', date);
        console.log('Parsed date (IST):', appointmentDateIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Today (IST):', todayIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        console.log('Is future date?', appointmentDateIST > todayIST);

        // Validate it's a future date in IST
        if (appointmentDateIST <= todayIST) {
            return "Appointment date must be in the future. Please provide a future date like 'tomorrow', 'next Monday', or a specific future date.";
        }

        // Store date in YYYY-MM-DD format (IST)
        date = getISTDateString(appointmentDate);
        console.log('Final stored date (IST):', date);

        // Store appointment in MongoDB
        const appointmentData = {
            name: name,
            date: date,
            purpose: purpose,
            source: 'voice_call_plivo',
            timezone: 'IST'
        };

        const storageResult = await storeAppointmentInMongoDB(appointmentData);

        if (storageResult.success) {
            const formattedDisplayDate = formatISTDate(appointmentDateIST);
            return `Appointment successfully booked for ${name}! Date: ${formattedDisplayDate}, Purpose: ${purpose}. Your appointment is pending confirmation.`;
        } else {
            return `Appointment details recorded for ${name}, but there was an issue storing the appointment in our system. Please contact us directly to confirm.`;
        }
    }
};

// API Routes
app.get('/', async (request, reply) => {
    reply.send({ message: 'Plivo Media Stream Server is running!' });
});

app.post("/incoming-call", (request, reply) => {
    const fromNumber = request.body.From;
    const callSid = request.body.CallSid;
    
    console.log('Incoming call from:', fromNumber, 'Call SID:', callSid);
    console.log('Current IST time:', getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    
    // Store call information in memory
    activeCalls.set(callSid, {
        phoneNumber: fromNumber,
        callSid: callSid,
        timestamp: Date.now(),
        istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
    
    // Clean up old entries (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    for (let [key, value] of activeCalls.entries()) {
        if (value.timestamp < oneHourAgo) {
            activeCalls.delete(key);
        }
    }
    
    const PlivoXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream streamTimeout="86400" keepCallAlive="true" bidirectional="true" contentType="audio/x-mulaw;rate=8000" audioTrack="inbound" >
        ws://${request.headers.host}/media-stream
    </Stream>
</Response>`;

    reply.type('text/xml').send(PlivoXMLResponse);
});

app.post('/make_call', async (request, reply) => {
    const { to } = request.body;
    if (!to) return reply.status(400).send({ error: "Missing 'to' number" });

    try {
        const call = await plivoClient.calls.create(
            PLIVO_NUMBER,
            to,
            `${NGROK_URL}/incoming-call`
        );
        return reply.send(call);
    } catch (error) {
        console.error("Error making call:", error);
        return reply.status(500).send({ error: error.message });
    }
});

// API Routes for managing appointments (SAME ROUTES AS CODE 1)
app.get('/appointments', async (request, reply) => {
    if (!appointmentsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const appointments = await appointmentsCollection.find({}).sort({ createdAt: -1 }).toArray();
        
        // Convert dates to IST for display
        const appointmentsWithIST = appointments.map(appointment => ({
            ...appointment,
            displayDate: formatISTDate(new Date(appointment.date + 'T00:00:00+05:30')),
            createdIST: toIST(appointment.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }));
        
        return reply.send({ appointments: appointmentsWithIST });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        return reply.status(500).send({ error: 'Failed to fetch appointments' });
    }
});

app.get('/appointments/:phoneNumber', async (request, reply) => {
    const { phoneNumber } = request.params;
    
    if (!appointmentsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const appointments = await appointmentsCollection.find({ 
            phoneNumber: phoneNumber 
        }).sort({ createdAt: -1 }).toArray();
        
        // Convert dates to IST for display
        const appointmentsWithIST = appointments.map(appointment => ({
            ...appointment,
            displayDate: formatISTDate(new Date(appointment.date + 'T00:00:00+05:30')),
            createdIST: toIST(appointment.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }));
        
        return reply.send({ 
            phoneNumber,
            appointments: appointmentsWithIST 
        });
    } catch (error) {
        console.error('Error fetching appointments by phone number:', error);
        return reply.status(500).send({ error: 'Failed to fetch appointments' });
    }
});

// ===========================
// TRANSCRIPT API ENDPOINTS (SAME ROUTES AS CODE 1)
// ===========================

// Get all transcripts
app.get('/api/transcripts', async (request, reply) => {
    console.log('🔄 SERVER: /api/transcripts endpoint called');
    
    if (!callTranscriptsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const { page = 1, limit = 20 } = request.query;
        const skip = (page - 1) * limit;
        
        const transcripts = await callTranscriptsCollection
            .find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await callTranscriptsCollection.countDocuments({});
        
        const transcriptSummaries = transcripts.map(transcript => ({
            callSid: transcript.callSid,
            phoneNumber: transcript.phoneNumber || 'Unknown',
            startTime: transcript.startTime,
            endTime: transcript.endTime || null,
            duration: transcript.duration || null,
            conversationCount: transcript.conversation ? transcript.conversation.length : 0,
            hasSummary: !!transcript.summary,
            lastUpdated: transcript.updatedAt || transcript.createdAt,
            createdAt: transcript.createdAt
        }));
        
        return reply.send({
            success: true,
            count: transcriptSummaries.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            transcripts: transcriptSummaries
        });
    } catch (error) {
        console.error('Error fetching transcripts:', error);
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch transcripts' 
        });
    }
});

// Get transcript for specific call
app.get('/api/transcripts/:callSid', async (request, reply) => {
    const { callSid } = request.params;
    
    if (!callTranscriptsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }
    
    try {
        const transcript = await callTranscriptsCollection.findOne({ callSid });
        
        if (!transcript) {
            return reply.status(404).send({
                success: false,
                error: 'No transcript found for this call'
            });
        }
        
        return reply.send({
            success: true,
            callSid,
            phoneNumber: transcript.phoneNumber || 'Unknown',
            startTime: transcript.startTime,
            endTime: transcript.endTime || null,
            duration: transcript.duration || null,
            summary: transcript.summary || null,
            conversation: transcript.conversation || [],
            conversationCount: transcript.conversation ? transcript.conversation.length : 0,
            createdAt: transcript.createdAt,
            updatedAt: transcript.updatedAt
        });
    } catch (error) {
        console.error('Error fetching call transcript:', error);
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch call transcript' 
        });
    }
});

// Get transcripts by phone number
app.get('/api/transcripts/phone/:phoneNumber', async (request, reply) => {
    const { phoneNumber } = request.params;
    
    if (!callTranscriptsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }
    
    try {
        const transcripts = await callTranscriptsCollection
            .find({ phoneNumber })
            .sort({ createdAt: -1 })
            .toArray();
        
        if (transcripts.length === 0) {
            return reply.status(404).send({
                success: false,
                error: 'No transcripts found for this phone number'
            });
        }
        
        const transcriptSummaries = transcripts.map(transcript => ({
            callSid: transcript.callSid,
            startTime: transcript.startTime,
            endTime: transcript.endTime || null,
            duration: transcript.duration || null,
            conversationCount: transcript.conversation ? transcript.conversation.length : 0,
            hasSummary: !!transcript.summary,
            lastMessage: transcript.conversation && transcript.conversation.length > 0 
                ? transcript.conversation[transcript.conversation.length - 1]
                : null,
            createdAt: transcript.createdAt
        }));
        
        return reply.send({
            success: true,
            phoneNumber,
            count: transcriptSummaries.length,
            transcripts: transcriptSummaries
        });
    } catch (error) {
        console.error('Error fetching transcripts by phone number:', error);
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch transcripts' 
        });
    }
});

// Generate summary from transcript
app.post('/api/transcripts/:callSid/summary', async (request, reply) => {
    const { callSid } = request.params;
    const { style = 'concise' } = request.body;

    if (!callTranscriptsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        // Get the transcript
        const transcript = await callTranscriptsCollection.findOne({ callSid });
        
        if (!transcript || !transcript.conversation || transcript.conversation.length === 0) {
            return reply.status(404).send({
                success: false,
                error: 'No transcript found or conversation is empty'
            });
        }

        console.log(`Generating summary for call ${callSid} with ${transcript.conversation.length} conversation entries`);

        // Prepare conversation text for OpenAI
        const conversationText = transcript.conversation
            .map(entry => `${entry.type === 'user' ? 'Caller' : 'Assistant'}: ${entry.text}`)
            .join('\n');

        // Create prompt based on style
        let systemPrompt, userPrompt;
        
        switch(style) {
            case 'detailed':
                systemPrompt = "You are a professional call analyst. Create a detailed summary including: 1) Call purpose, 2) Key issues discussed, 3) Solutions provided, 4) Action items, 5) Next steps. Format as a structured report.";
                userPrompt = `Please analyze this customer service call and provide a detailed summary:\n\n${conversationText}`;
                break;
            case 'bullet':
                systemPrompt = "You are a call summarizer. Extract key points as bullet points. Focus on: customer needs, solutions offered, decisions made, and follow-up actions.";
                userPrompt = `Create a bullet-point summary of this call:\n\n${conversationText}`;
                break;
            case 'concise':
            default:
                systemPrompt = "You are a concise call summarizer. Provide a brief 2-3 paragraph summary covering: main purpose, key discussion points, and outcome.";
                userPrompt = `Provide a concise summary of this call:\n\n${conversationText}`;
        }

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 1000
        });

        const summaryText = completion.choices[0].message.content;

        // Store the summary in MongoDB
        const summaryData = {
            text: summaryText,
            style: style,
            generatedAt: Date.now(),
            generatedAtIST: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            model: "gpt-3.5-turbo"
        };

        await callTranscriptsCollection.updateOne(
            { callSid },
            { 
                $set: { 
                    summary: summaryData,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`Summary generated successfully for call ${callSid}`);

        return reply.send({
            success: true,
            callSid,
            summary: summaryData,
            transcriptInfo: {
                conversationLength: transcript.conversation.length,
                duration: transcript.duration ? `${Math.round(transcript.duration / 1000)} seconds` : 'Unknown',
                phoneNumber: transcript.phoneNumber
            }
        });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        
        // Fallback: Create a simple summary
        const fallbackSummary = createFallbackSummary(transcript);
        
        const summaryData = {
            text: fallbackSummary,
            style: 'fallback',
            generatedAt: Date.now(),
            generatedAtIST: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            note: 'Generated using fallback method due to OpenAI error'
        };

        await callTranscriptsCollection.updateOne(
            { callSid },
            { 
                $set: { 
                    summary: summaryData,
                    updatedAt: new Date()
                }
            }
        );

        return reply.send({
            success: true,
            callSid,
            summary: summaryData,
            note: 'Summary generated using fallback method due to OpenAI error',
            transcriptInfo: {
                conversationLength: transcript.conversation.length,
                duration: transcript.duration ? `${Math.round(transcript.duration / 1000)} seconds` : 'Unknown'
            }
        });
    }
});

// Get existing summary
app.get('/api/transcripts/:callSid/summary', async (request, reply) => {
    const { callSid } = request.params;
    
    if (!callTranscriptsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }
    
    try {
        const transcript = await callTranscriptsCollection.findOne({ callSid });
        
        if (!transcript) {
            return reply.status(404).send({
                success: false,
                error: 'No transcript found for this call'
            });
        }
        
        if (!transcript.summary) {
            return reply.send({
                success: true,
                callSid,
                hasSummary: false,
                message: 'No summary generated yet. Use POST /api/transcripts/:callSid/summary to generate one.',
                transcriptAvailable: true,
                conversationLength: transcript.conversation.length
            });
        }
        
        return reply.send({
            success: true,
            callSid,
            hasSummary: true,
            summary: transcript.summary,
            transcriptInfo: {
                conversationLength: transcript.conversation.length,
                duration: transcript.duration,
                phoneNumber: transcript.phoneNumber
            }
        });
        
    } catch (error) {
        console.error('Error fetching summary:', error);
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch summary' 
        });
    }
});

// Delete summary
app.delete('/api/transcripts/:callSid/summary', async (request, reply) => {
    const { callSid } = request.params;
    
    if (!callTranscriptsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }
    
    try {
        const transcript = await callTranscriptsCollection.findOne({ callSid });
        
        if (!transcript) {
            return reply.status(404).send({
                success: false,
                error: 'No transcript found for this call'
            });
        }
        
        const hadSummary = !!transcript.summary;
        
        await callTranscriptsCollection.updateOne(
            { callSid },
            { 
                $unset: { summary: "" },
                $set: { updatedAt: new Date() }
            }
        );
        
        return reply.send({
            success: true,
            callSid,
            message: hadSummary ? 'Summary deleted successfully' : 'No summary existed',
            hasSummary: false
        });
        
    } catch (error) {
        console.error('Error deleting summary:', error);
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to delete summary' 
        });
    }
});

// Get real-time transcript updates (WebSocket endpoint)
app.get('/api/transcripts/stream', (req, res) => {
    // This is a placeholder for WebSocket implementation
    // For Express, you might want to use ws or socket.io
    res.status(501).send({ error: 'WebSocket endpoint not implemented for Express' });
});

// WebSocket handling
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/media-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

const sendInitialConversationItem = (realtimeWS) => {
    const initialConversationItem = {
        type: 'conversation.item.create',
        item: {
            type: 'message',
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: 'Hello'
                }
            ]
        }
    };
    
    realtimeWS.send(JSON.stringify(initialConversationItem));
    realtimeWS.send(JSON.stringify({ type: 'response.create' }));
};

let sessionUpdated = false;

const sendSessionUpdate = (realtimeWS) => {
    if (!sessionUpdated) {
        realtimeWS.send(JSON.stringify(SessionUpdate));
        sessionUpdated = true;
        console.log('Session update sent');
    }
    sendInitialConversationItem(realtimeWS);
};

const startRealtimeWSConnection = (plivoWS) => {
    const realtimeWS = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17', {
        headers: {
            "Authorization": "Bearer " + OPENAI_API_KEY,
            "OpenAI-Beta": "realtime=v1",
        }
    });

    let isResponseActive = false;
    let callerPhoneNumber = null;
    let currentCallSid = null;

    realtimeWS.on('open', () => {
        console.log('OpenAI WebSocket connected');
        sessionUpdated = false;
        setTimeout(() => {
            sendSessionUpdate(realtimeWS);
        }, 100);
    });

    realtimeWS.on('close', () => {
        console.log('Disconnected from OpenAI Realtime API');
        sessionUpdated = false;
    });

    realtimeWS.on('error', (error) => {
        console.log('Error in OpenAI WebSocket: ', error);
    });

    realtimeWS.on('message', async (message) => {
        try {
            const response = JSON.parse(message);

            switch (response.type) {
                case 'conversation.item.input_audio_transcription.completed':
                    console.log('Transcription completed:', response.transcript);
                    
                    // Store user transcription in MongoDB
                    if (response.transcript && response.transcript.trim() && currentCallSid) {
                        const userEntry = {
                            type: 'user',
                            text: response.transcript,
                            timestamp: Date.now(),
                            istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        };
                        
                        // Create transcript if not exists
                        let transcript = await getTranscript(currentCallSid);
                        if (!transcript) {
                            await createTranscript(currentCallSid, callerPhoneNumber);
                        }
                        
                        await addConversationEntry(currentCallSid, userEntry);
                    }
                    break;

                case "response.created":
                    isResponseActive = true;
                    break;

                case "response.done":
                    isResponseActive = false;
                    const outputs = response.response.output;
                    if (outputs.length > 0 && outputs[0].content && outputs[0].content.length > 0) {
                        const transcript = outputs[0].content[0].transcript;
                        console.log('AI RESPONSE:', transcript);
                        
                        // Store AI response in MongoDB
                        if (transcript && transcript.trim() && currentCallSid) {
                            const aiEntry = {
                                type: 'ai',
                                text: transcript,
                                timestamp: Date.now(),
                                istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                            };
                            
                            await addConversationEntry(currentCallSid, aiEntry);
                        }
                    }

                    // Handle function calls for appointment booking
                    const functionCall = outputs.find(
                        (output) => output.type === "function_call"
                    );
                    
                    if (functionCall && TOOLS[functionCall.name]) {
                        console.log('Function call detected:', functionCall.name);
                        console.log('Function arguments:', functionCall.arguments);

                        try {
                            let parsedArgs;
                            try {
                                parsedArgs = JSON.parse(functionCall.arguments);
                            } catch (parseError) {
                                console.error('Error parsing function arguments:', parseError);
                                // Try to fix common JSON parsing issues
                                const fixedArgs = functionCall.arguments
                                    .replace(/(\w+):/g, '"$1":')
                                    .replace(/'/g, '"');
                                parsedArgs = JSON.parse(fixedArgs);
                            }

                            const result = await TOOLS[functionCall.name](parsedArgs);

                            const conversationItemCreate = {
                                type: "conversation.item.create",
                                item: {
                                    type: "function_call_output",
                                    call_id: functionCall.call_id,
                                    output: result,
                                },
                            };
                            realtimeWS.send(JSON.stringify(conversationItemCreate));

                            // Trigger a new response after function call
                            setTimeout(() => {
                                realtimeWS.send(JSON.stringify({ type: "response.create" }));
                            }, 100);

                        } catch (error) {
                            console.error('Error executing function:', error);
                            
                            const errorOutput = {
                                type: "conversation.item.create",
                                item: {
                                    type: "function_call_output",
                                    call_id: functionCall.call_id,
                                    output: `Error: ${error.message}`,
                                },
                            };
                            realtimeWS.send(JSON.stringify(errorOutput));
                            
                            setTimeout(() => {
                                realtimeWS.send(JSON.stringify({ type: "response.create" }));
                            }, 100);
                        }
                    }
                    break;

                case 'session.updated':
                    console.log('Session updated successfully');
                    break;

                case 'input_audio_buffer.speech_started':
                    const clearAudioData = {
                        "event": "clearAudio",
                        "stream_id": plivoWS.streamId
                    };
                    plivoWS.send(JSON.stringify(clearAudioData));

                    if (isResponseActive) {
                        const data = {
                            "type": "response.cancel"
                        };
                        realtimeWS.send(JSON.stringify(data));
                    }
                    break;

                case 'response.audio.delta':
                    const audioDelta = {
                        event: 'playAudio',
                        media: {
                            contentType: 'audio/x-mulaw',
                            sampleRate: 8000,
                            payload: Buffer.from(response.delta, 'base64').toString('base64')
                        }
                    };
                    plivoWS.send(JSON.stringify(audioDelta));
                    break;

                case 'error':
                    if (response.error?.code !== 'response_cancel_not_active') {
                        console.log('Error received: ', response);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing OpenAI message: ', error);
        }
    });
    
    return realtimeWS;
};

wss.on('connection', (connection) => {
    console.log('Client connected to WebSocket');
    const realtimeWS = startRealtimeWSConnection(connection);

    connection.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            switch (data.event) {
                case 'media':
                    if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
                        const audioAppend = {
                            type: 'input_audio_buffer.append',
                            audio: data.media.payload
                        };
                        realtimeWS.send(JSON.stringify(audioAppend));
                    }
                    break;
                case 'start':
                    connection.streamId = data.start.streamId;
                    
                    // Extract callSid from streamId (Plivo format)
                    // This is a simplified approach - you might need to adjust based on actual Plivo format
                    const streamId = data.start.streamId;
                    for (let [callSid, callInfo] of activeCalls.entries()) {
                        // Try to match based on timestamp or other heuristics
                        // Since Plivo doesn't provide direct mapping, we'll use the most recent call
                        if (Date.now() - callInfo.timestamp < 5000) { // Within 5 seconds
                            const realtimeWS = connection.realtimeWS || startRealtimeWSConnection(connection);
                            realtimeWS.callerPhoneNumber = callInfo.phoneNumber;
                            realtimeWS.currentCallSid = callSid;
                            console.log('Found matching call info:', { 
                                callerPhoneNumber: callInfo.phoneNumber, 
                                currentCallSid: callSid 
                            });
                            break;
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error parsing message: ', error);
        }
    });

    connection.on('close', () => {
        if (realtimeWS.readyState === WebSocket.OPEN) realtimeWS.close();
        
        // Update call end time in MongoDB and generate summary
        if (realtimeWS.currentCallSid) {
            updateCallEnd(realtimeWS.currentCallSid);
            
            // Auto-generate summary after call ends
            setTimeout(async () => {
                try {
                    await generateAutoSummary(realtimeWS.currentCallSid);
                } catch (error) {
                    console.error('Error auto-generating summary on close:', error);
                }
            }, 2000);
            
            activeCalls.delete(realtimeWS.currentCallSid);
            console.log('Cleaned up call on connection close:', realtimeWS.currentCallSid);
        }
        
        console.log('Client disconnected');
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully');
    if (mongoClient) {
        await mongoClient.close();
    }
    process.exit(0);
});

// Initialize MongoDB and start server
async function startServer() {
    try {
        await initializeMongoDB();
        server.listen(PORT, () => {
            console.log(`Server started on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();