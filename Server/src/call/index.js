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
    origin: ['http://localhost:8081', 'http://localhost:5173', 'http://localhost:3000', 'https://eceafd0183fa.ngrok-free.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const transcriptWss = new WebSocketServer({ noServer: true });
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

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// Store active calls using Plivo's requestUuid
const activeCalls = new Map();
const streamCallMap = new Map();

let mongoClient;
let db;
let appointmentsCollection;
let callTranscriptsCollection; // For outbound calls
let inboundTranscriptsCollection; // For inbound calls

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getCurrentISTDate() {
    const now = new Date();
    return new Date(now.getTime() + IST_OFFSET);
}

function toIST(date) {
    return new Date(date.getTime() + IST_OFFSET);
}

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

function getISTDateString(date) {
    const istDate = toIST(date);
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const day = String(istDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==================== MONGODB INITIALIZATION ====================
async function initializeMongoDB() {
    if (!MONGODB_URI) {
        console.warn('❌ MongoDB URI not found. Database storage will be disabled.');
        return;
    }

    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        db = mongoClient.db('voxora');
        
        await createCollections();
        await cleanupOldIndexes();
        await createNewIndexes();
        
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
    }
}

async function createCollections() {
    try {
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('call_transcripts')) {
            await db.createCollection('call_transcripts');
        } else {
            callTranscriptsCollection = db.collection('call_transcripts');
        }
        
        if (!collectionNames.includes('inbound_transcripts')) {
            await db.createCollection('inbound_transcripts');
        } else {
            inboundTranscriptsCollection = db.collection('inbound_transcripts');
        }
        
        if (!collectionNames.includes('appointments')) {
            await db.createCollection('appointments');
        } else {
            appointmentsCollection = db.collection('appointments');
        }
        
    } catch (error) {
        console.error('❌ Error creating collections:', error);
    }
}

async function cleanupOldIndexes() {
    try {
        const callTranscriptIndexes = await callTranscriptsCollection.indexes();
        for (const index of callTranscriptIndexes) {
            if (index.name !== '_id_') {
                try {
                    await callTranscriptsCollection.dropIndex(index.name);
                } catch (error) {}
            }
        }
        
        const inboundTranscriptIndexes = await inboundTranscriptsCollection.indexes();
        for (const index of inboundTranscriptIndexes) {
            if (index.name !== '_id_') {
                try {
                    await inboundTranscriptsCollection.dropIndex(index.name);
                } catch (error) {}
            }
        }
    } catch (error) {}
}

async function createNewIndexes() {
    try {        
        // Indexes for call_transcripts (OUTBOUND)
        await callTranscriptsCollection.createIndex({ requestUuid: 1 }, { 
            unique: true,
            name: 'call_transcripts_requestUuid_unique',
            sparse: true
        });
        
        await callTranscriptsCollection.createIndex({ phoneNumber: 1 }, {
            name: 'call_transcripts_phoneNumber_index'
        });
        
        await callTranscriptsCollection.createIndex({ createdAt: 1 }, { 
            name: 'call_transcripts_createdAt_index'
        });
        
        await callTranscriptsCollection.createIndex({ createdAt: 1 }, { 
            expireAfterSeconds: 7 * 24 * 60 * 60,
            name: 'call_transcripts_createdAt_ttl'
        });
        
        await callTranscriptsCollection.createIndex({ userId: 1 }, {
            name: 'call_transcripts_userId_index'
        });        
        // Indexes for inbound_transcripts (INBOUND)
        await inboundTranscriptsCollection.createIndex({ requestUuid: 1 }, { 
            unique: true,
            name: 'inbound_transcripts_requestUuid_unique',
            sparse: true
        });
        
        await inboundTranscriptsCollection.createIndex({ phoneNumber: 1 }, {
            name: 'inbound_transcripts_phoneNumber_index'
        });
        
        await inboundTranscriptsCollection.createIndex({ createdAt: 1 }, { 
            name: 'inbound_transcripts_createdAt_index'
        });
        
        await inboundTranscriptsCollection.createIndex({ createdAt: 1 }, { 
            expireAfterSeconds: 7 * 24 * 60 * 60,
            name: 'inbound_transcripts_createdAt_ttl'
        });
        
        // Indexes for appointments
        await appointmentsCollection.createIndex({ phoneNumber: 1 }, { name: 'appointments_phone_index' });
        await appointmentsCollection.createIndex({ createdAt: 1 }, { name: 'appointments_created_index' });
        await appointmentsCollection.createIndex({ date: 1 }, { name: 'appointments_date_index' });
        
    } catch (error) {
        console.error('❌ Index creation error:', error.message);
    }
}
// ==================== END MONGODB INIT ====================

const transcriptClients = new Set();

// ==================== TRANSCRIPT FUNCTIONS ====================
function getTranscriptCollection(isInbound = true) {
    return isInbound ? inboundTranscriptsCollection : callTranscriptsCollection;
}

async function ensureCollection(isInbound = true) {
    const collection = getTranscriptCollection(isInbound);
    if (!collection) {
        if (isInbound) {
            inboundTranscriptsCollection = db.collection('inbound_transcripts');
            return inboundTranscriptsCollection;
        } else {
            callTranscriptsCollection = db.collection('call_transcripts');
            return callTranscriptsCollection;
        }
    }
    return collection;
}

// ========== CRITICAL FIX: Track outbound calls ==========
const outboundCallTracker = new Map();

async function createTranscript(requestUuid, phoneNumber, isInbound = true, userId = null) {
    console.log(`📋 CREATE TRANSCRIPT: Creating ${isInbound ? 'INBOUND' : 'OUTBOUND'} transcript for requestUuid: ${requestUuid}, phone: ${phoneNumber}`);
    
    const collection = await ensureCollection(isInbound);
    
    if (!collection) {
        console.log(`❌ CREATE TRANSCRIPT: No database collection available`);
        return null;
    }
    
    try {
        // Check if transcript already exists
        const existing = await collection.findOne({ requestUuid });
        if (existing) {
            console.log(`📋 CREATE TRANSCRIPT: Transcript already exists for ${requestUuid}`);
            return existing;
        }
        
        const transcript = {
            requestUuid,
            callSid: requestUuid,
            phoneNumber: phoneNumber || 'Unknown',
            userId: userId ? new ObjectId(userId) : null,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            conversation: [],
            summary: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            istStartTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            status: 'active',
            callType: isInbound ? 'inbound' : 'outbound'
        };
        
        console.log(`📋 INSERTING ${isInbound ? 'INBOUND' : 'OUTBOUND'} TRANSCRIPT:`, {
            requestUuid,
            phoneNumber,
            callType: isInbound ? 'inbound' : 'outbound'
        });
        
        const result = await collection.insertOne(transcript);
        console.log(`✅ CREATE TRANSCRIPT: Created ${isInbound ? 'inbound' : 'outbound'} transcript for call ${requestUuid}`);
        
        return { ...transcript, _id: result.insertedId };
        
    } catch (error) {
        console.error(`❌ CREATE TRANSCRIPT: Error creating transcript:`, error.message);
        return null;
    }
}

function broadcastTranscriptUpdate(requestUuid, entry, callType = 'inbound') {
    const message = JSON.stringify({
        type: 'transcript_update',
        requestUuid,
        entry,
        callType,
        timestamp: Date.now()
    });
    
    transcriptClients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
}

async function addConversationEntry(requestUuid, entry, isInbound = true) {
    console.log(`📝 ADD ENTRY: Adding entry for ${isInbound ? 'INBOUND' : 'OUTBOUND'} requestUuid: ${requestUuid}`);
    
    const collection = await ensureCollection(isInbound);
    
    if (!collection) {
        console.log(`❌ ADD ENTRY: No database collection available`);
        broadcastTranscriptUpdate(requestUuid, entry, isInbound ? 'inbound' : 'outbound');
        return;
    }
    
    try {
        let transcript = await collection.findOne({ requestUuid });
        if (!transcript) {
            console.log(`📝 ADD ENTRY: No transcript found, creating new one`);
            transcript = await createTranscript(requestUuid, 'Unknown', isInbound);
            if (!transcript) {
                console.log(`❌ ADD ENTRY: Failed to create transcript`);
                return;
            }
        }
        
        const conversation = transcript.conversation || [];
        conversation.push(entry);
        
        await collection.updateOne(
            { requestUuid },
            { 
                $set: { 
                    conversation,
                    updatedAt: new Date()
                }
            }
        );
        
        console.log(`✅ ADD ENTRY: Updated ${isInbound ? 'inbound' : 'outbound'} transcript ${requestUuid}`);
        
        broadcastTranscriptUpdate(requestUuid, entry, isInbound ? 'inbound' : 'outbound');
    } catch (error) {
        console.error(`❌ ADD ENTRY: Error updating transcript:`, error.message);
        broadcastTranscriptUpdate(requestUuid, entry, isInbound ? 'inbound' : 'outbound');
    }
}

async function updateCallEnd(requestUuid, isInbound = true) {
    console.log(`🛑 UPDATE CALL END: Updating end time for ${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}`);
    
    const collection = await ensureCollection(isInbound);
    
    if (!collection) {
        console.log(`❌ UPDATE CALL END: No database collection available`);
        return;
    }
    
    try {
        const transcript = await collection.findOne({ requestUuid });
        if (transcript) {
            const endTime = Date.now();
            const duration = endTime - transcript.startTime;
            
            await collection.updateOne(
                { requestUuid },
                { 
                    $set: { 
                        endTime,
                        duration,
                        updatedAt: new Date(),
                        istEndTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                        status: 'completed'
                    }
                }
            );
            
            console.log(`✅ UPDATE CALL END: Updated end time for ${isInbound ? 'inbound' : 'outbound'} ${requestUuid}, duration: ${duration}ms`);
            
            return await collection.findOne({ requestUuid });
        } else {
            console.log(`❌ UPDATE CALL END: No transcript found for ${requestUuid}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ UPDATE CALL END: Error updating call:`, error.message);
        return null;
    }
}

async function generateAutoSummary(requestUuid, isInbound = true) {
    console.log(`🤖 AUTO-SUMMARY: Starting generation for ${isInbound ? 'INBOUND' : 'OUTBOUND'} call ${requestUuid}`);
    
    const collection = await ensureCollection(isInbound);
    
    if (!collection) {
        console.log(`❌ AUTO-SUMMARY: No database collection available`);
        return;
    }
    
    try {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const transcript = await collection.findOne({ requestUuid });
        
        if (!transcript || !transcript.conversation || transcript.conversation.length === 0) {
            console.log(`❌ AUTO-SUMMARY: No conversation found for ${requestUuid}`);
            return;
        }

        console.log(`✅ AUTO-SUMMARY: Found transcript with ${transcript.conversation.length} messages`);
        
        const conversationText = transcript.conversation
            .map(entry => `${entry.type === 'user' ? 'Caller' : 'Assistant'}: ${entry.text}`)
            .join('\n');

        let summaryText;
        
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a concise call summarizer. Provide a brief 2-3 paragraph summary covering: main purpose, key discussion points, and outcome." 
                    },
                    { 
                        role: "user", 
                        content: `Provide a concise summary of this ${isInbound ? 'inbound' : 'outbound'} call:\n\n${conversationText}` 
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            summaryText = completion.choices[0].message.content;
            console.log(`✅ AUTO-SUMMARY: OpenAI API successful`);
        } catch (openaiError) {
            console.log(`⚠️ AUTO-SUMMARY: OpenAI error:`, openaiError.message);
            summaryText = "Summary could not be generated. Please view the transcript for details.";
        }

        const summaryData = {
            text: summaryText,
            style: 'auto-generated',
            generatedAt: Date.now(),
            generatedAtIST: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            model: "gpt-3.5-turbo",
            callType: isInbound ? 'inbound' : 'outbound'
        };

        await collection.updateOne(
            { requestUuid },
            { 
                $set: { 
                    summary: summaryData,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`🎉 AUTO-SUMMARY: Successfully generated and stored for ${requestUuid}`);
        
        broadcastTranscriptUpdate(requestUuid, {
            type: 'summary',
            text: summaryText,
            timestamp: Date.now(),
            callType: isInbound ? 'inbound' : 'outbound'
        });
        
    } catch (error) {
        console.error(`❌ AUTO-SUMMARY: Error:`, error.message);
    }
}

async function getTranscript(requestUuid, isInbound = true) {
    console.log(`📄 GET TRANSCRIPT: Fetching ${isInbound ? 'INBOUND' : 'OUTBOUND'} transcript for ${requestUuid}`);
    
    const collection = await ensureCollection(isInbound);
    
    if (!collection) {
        console.log(`❌ GET TRANSCRIPT: No database collection available`);
        return null;
    }
    
    try {
        const transcript = await collection.findOne({ requestUuid });
        return transcript;
    } catch (error) {
        console.error(`❌ GET TRANSCRIPT: Error fetching transcript:`, error.message);
        return null;
    }
}

async function storeAppointmentInMongoDB(appointmentData) {
    if (!appointmentsCollection) {
        if (db) {
            appointmentsCollection = db.collection('appointments');
        }
    }
    
    if (!appointmentsCollection) {
        return { 
            success: false, 
            message: 'Database not configured' 
        };
    }

    try {
        const appointmentDate = new Date(appointmentData.date + 'T00:00:00+05:30');
        const todayIST = getCurrentISTDate();
        todayIST.setHours(0, 0, 0, 0);

        if (appointmentDate < todayIST) {
            return { 
                success: false, 
                message: 'Appointment date must be in the future' 
            };
        }

        const result = await appointmentsCollection.insertOne({
            ...appointmentData,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            timezone: 'IST',
            storedAt: new Date().toISOString(),
            storedAtIST: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
        
        return { 
            success: true, 
            message: 'Appointment stored successfully',
            appointmentId: result.insertedId
        };
    } catch (error) {
        return { 
            success: false, 
            message: 'Failed to store appointment in database',
            error: error.message
        };
    }
}

const TOOLS = {
    book_appointment: async ({ name, date, purpose, phoneNumber, requestUuid }) => {
        if (!name || !date || !purpose) {
            return "Missing required appointment details. Please provide name, date, and purpose.";
        }

        const nowIST = getCurrentISTDate();
        let appointmentDate = chrono.parseDate(date, nowIST, { forwardDate: true });
        
        if (!appointmentDate) {
            return "I couldn't understand the date. Please say something like 'tomorrow' or '26 October 2025'.";
        }

        const appointmentDateIST = toIST(appointmentDate);
        appointmentDateIST.setHours(0, 0, 0, 0);

        const todayIST = getCurrentISTDate();
        todayIST.setHours(0, 0, 0, 0);

        if (appointmentDateIST <= todayIST) {
            return "Appointment date must be in the future.";
        }

        const dateString = getISTDateString(appointmentDate);

        const appointmentData = {
            name: name.trim(),
            date: dateString,
            purpose: purpose.trim(),
            source: 'voice_call_plivo',
            timezone: 'IST',
            phoneNumber: phoneNumber || 'Unknown',
            requestUuid: requestUuid || 'unknown',
            createdFromCall: true
        };

        const storageResult = await storeAppointmentInMongoDB(appointmentData);

        if (storageResult.success) {
            const formattedDisplayDate = formatISTDate(appointmentDateIST);
            return `Appointment successfully booked for ${name}! Date: ${formattedDisplayDate}, Purpose: ${purpose}. Your appointment ID is ${storageResult.appointmentId}.`;
        } else {
            return `Appointment details recorded for ${name}, but there was an issue storing the appointment. Please contact support. Error: ${storageResult.message}`;
        }
    }
};

// ==================== API ROUTES ====================
app.get('/', async (request, reply) => {
    reply.send({ message: 'Plivo Media Stream Server is running!' });
});

app.get('/api/appointments', async (request, reply) => {
    if (!appointmentsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const { page = 1, limit = 20 } = request.query;
        const skip = (page - 1) * limit;
        
        const appointments = await appointmentsCollection
            .find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await appointmentsCollection.countDocuments({});
        
        return reply.send({
            success: true,
            count: appointments.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            appointments: appointments
        });
    } catch (error) {
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch appointments',
            details: error.message
        });
    }
});

// ========== CRITICAL FIX: Modified inbound call handler ==========
app.post("/incoming-call", async (request, reply) => {
    const fromNumber = request.body.From;
    const requestUuid = request.body.requestUuid || request.body.CallUUID || request.body.ALegUUID || request.body.RequestUUID || `plivo_${Date.now()}`;
    const callStatus = request.body.CallStatus || request.body.Event || 'in-progress';
    const direction = request.body.Direction || 'inbound';
    
    // ========== KEY FIX ==========
    // Determine if this is inbound or outbound based on Direction
    // Outbound calls initiated by us will have direction: 'outbound'
    // Inbound calls from external numbers will have direction: 'inbound'
    const isInbound = direction === 'inbound';
    
    if (callStatus === 'in-progress' || callStatus === 'ringing' || callStatus === 'answered') {
        activeCalls.set(requestUuid, {
            phoneNumber: fromNumber,
            requestUuid: requestUuid,
            timestamp: Date.now(),
            istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            status: callStatus,
            isInbound: isInbound,
            direction: direction
        });
        
        // Create transcript with correct type
        try {
            const transcript = await createTranscript(requestUuid, fromNumber, isInbound);
        } catch (error) {}
    } else if (callStatus === 'completed' || callStatus === 'hangup') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
            const updatedTranscript = await updateCallEnd(requestUuid, isInbound);
        } catch (error) {}
        
        setTimeout(async () => {
            try {
                await generateAutoSummary(requestUuid, isInbound);
            } catch (summaryError) {}
        }, 5000);
        
        activeCalls.delete(requestUuid);
    }
    
    const PlivoXMLResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream streamTimeout="86400" keepCallAlive="true" bidirectional="true" contentType="audio/x-mulaw;rate=8000" audioTrack="inbound" >
        ws://${request.headers.host}/media-stream
    </Stream>
</Response>`;

    reply.type('text/xml').send(PlivoXMLResponse);
});

// ========== CRITICAL FIX: Modified make_call handler ==========
app.post('/make_call', async (request, reply) => {
    const { to, userId, email } = request.body;
    
    if (!to) {
        return reply.status(400).send({ error: "Missing 'to' number" });
    }
    // Get actual userId from email if provided
    let actualUserId = userId;
    if (!actualUserId && email) {
        try {
            if (db) {
                const usersCollection = db.collection('users');
                const user = await usersCollection.findOne({ email });
                if (user) {
                    actualUserId = user._id.toString();
                } else {
                    actualUserId = email;
                }
            }
        } catch (error) {
            actualUserId = email || 'default-user';
        }
    }
    
    try {
        // For outbound calls, we need to track that this is OUR outbound call
        const tempRequestUuid = `outbound_temp_${Date.now()}`;
        outboundCallTracker.set(tempRequestUuid, {
            phoneNumber: to,
            timestamp: Date.now(),
            isInbound: false
        });
        
        const call = await plivoClient.calls.create(
            PLIVO_NUMBER,
            to.startsWith('+') ? to : `+91${to}`,
            `${NGROK_URL}/incoming-call`,
            {
                custom_headers: {
                    'X-Call-Direction': 'outbound',
                    'X-Original-Request-Uuid': tempRequestUuid
                }
            }
        );
        
        const requestUuid = call.requestUuid || `outbound_${Date.now()}`;

        activeCalls.set(requestUuid, {
            phoneNumber: to,
            requestUuid: requestUuid,
            callUuid: call.callUuid,
            timestamp: Date.now(),
            istTime: getCurrentISTDate().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            status: "outbound-initiated",
            isInbound: false,
            direction: 'outbound'
        });
        
        // Create outbound transcript immediately
        try {
            const transcript = await createTranscript(requestUuid, to, false, actualUserId);
        } catch (error) {}
        
        return reply.send(call);
    } catch (error) {
        return reply.status(500).send({ error: error.message });
    }
});

app.get('/api/transcripts', async (request, reply) => {
    const collection = await ensureCollection(true);
    
    if (!collection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const { page = 1, limit = 20 } = request.query;
        const skip = (page - 1) * limit;
        
        let filter = {};
        
        const transcripts = await collection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await collection.countDocuments(filter);
        
        const transcriptSummaries = transcripts.map(transcript => ({
            requestUuid: transcript.requestUuid,
            phoneNumber: transcript.phoneNumber || 'Unknown',
            startTime: transcript.startTime,
            endTime: transcript.endTime || null,
            duration: transcript.duration || null,
            conversationCount: transcript.conversation ? transcript.conversation.length : 0,
            hasSummary: !!transcript.summary,
            summary: transcript.summary || null,
            lastUpdated: transcript.updatedAt || transcript.createdAt,
            createdAt: transcript.createdAt,
            callType: transcript.callType || 'inbound',
            userId: transcript.userId || null
        }));
        
        return reply.send({
            success: true,
            count: transcriptSummaries.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            transcripts: transcriptSummaries,
            collection: 'inbound_transcripts'
        });
    } catch (error) {
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch inbound transcripts' 
        });
    }
});

app.get('/api/outbound-transcripts', async (request, reply) => {
    const collection = await ensureCollection(false);
    
    if (!collection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const { page = 1, limit = 20 } = request.query;
        const skip = (page - 1) * limit;
        
        let filter = {};
        if (request.query.userId) {
            filter.userId = new ObjectId(request.query.userId);
        }
        
        const transcripts = await collection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await collection.countDocuments(filter);
        
        const transcriptSummaries = transcripts.map(transcript => ({
            requestUuid: transcript.requestUuid,
            phoneNumber: transcript.phoneNumber || 'Unknown',
            startTime: transcript.startTime,
            endTime: transcript.endTime || null,
            duration: transcript.duration || null,
            conversationCount: transcript.conversation ? transcript.conversation.length : 0,
            hasSummary: !!transcript.summary,
            summary: transcript.summary || null,
            lastUpdated: transcript.updatedAt || transcript.createdAt,
            createdAt: transcript.createdAt,
            callType: transcript.callType || 'outbound',
            userId: transcript.userId || null
        }));
        
        return reply.send({
            success: true,
            count: transcriptSummaries.length,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            transcripts: transcriptSummaries,
            collection: 'call_transcripts'
        });
    } catch (error) {
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to fetch outbound transcripts' 
        });
    }
});

app.get('/api/transcripts/:requestUuid', async (request, reply) => {
    const { requestUuid } = request.params;
    
    let transcript = null;
    let collectionType = 'inbound';
    
    // Try inbound collection first
    let collection = await ensureCollection(true);
    if (collection) {
        transcript = await collection.findOne({ requestUuid });
    }
    
    // If not found in inbound, try outbound
    if (!transcript) {
        collection = await ensureCollection(false);
        collectionType = 'outbound';
        
        if (collection) {
            transcript = await collection.findOne({ requestUuid });
        }
    }
    
    if (!transcript) {
        return reply.status(404).send({
            success: false,
            error: 'No transcript found for this call'
        });
    }
    
    return reply.send({
        success: true,
        requestUuid,
        phoneNumber: transcript.phoneNumber || 'Unknown',
        startTime: transcript.startTime,
        endTime: transcript.endTime || null,
        duration: transcript.duration || null,
        summary: transcript.summary || null,
        conversation: transcript.conversation || [],
        conversationCount: transcript.conversation ? transcript.conversation.length : 0,
        createdAt: transcript.createdAt,
        updatedAt: transcript.updatedAt,
        callType: transcript.callType || collectionType,
        collection: collectionType
    });
});

// Debug endpoint to check active calls
app.get("/debug/active-calls", (request, reply) => {
    const calls = Array.from(activeCalls.entries()).map(([key, value]) => ({
        key,
        ...value,
        age: Date.now() - value.timestamp
    }));
    return reply.send({ 
        activeCalls: calls, 
        count: activeCalls.size,
        outboundTracker: Array.from(outboundCallTracker.entries())
    });
});

app.get('/debug/mongodb-status', async (request, reply) => {
    try {
        if (!db) {
            return reply.send({ error: 'Database not connected' });
        }
        
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        const callTranscriptsExists = collectionNames.includes('call_transcripts');
        const inboundTranscriptsExists = collectionNames.includes('inbound_transcripts');
        const appointmentsExists = collectionNames.includes('appointments');
        
        let transcriptCount = 0;
        let inboundTranscriptCount = 0;
        let appointmentCount = 0;
        
        if (callTranscriptsExists) {
            const collection = db.collection('call_transcripts');
            transcriptCount = await collection.countDocuments();
        }
        
        if (inboundTranscriptsExists) {
            const collection = db.collection('inbound_transcripts');
            inboundTranscriptCount = await collection.countDocuments();
        }
        
        if (appointmentsExists) {
            const collection = db.collection('appointments');
            appointmentCount = await collection.countDocuments();
        }
        
        return reply.send({
            success: true,
            database: 'voxora',
            collections: {
                call_transcripts: {
                    exists: callTranscriptsExists,
                    count: transcriptCount,
                    description: 'For outbound calls'
                },
                inbound_transcripts: {
                    exists: inboundTranscriptsExists,
                    count: inboundTranscriptCount,
                    description: 'For inbound calls'
                },
                appointments: {
                    exists: appointmentsExists,
                    count: appointmentCount,
                    description: 'For appointments'
                }
            },
            allCollections: collectionNames
        });
        
    } catch (error) {
        return reply.status(500).send({ error: error.message });
    }
});

// ==================== WEBSOCKET HANDLING ====================
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/media-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else if (request.url === '/transcript-stream') {
        transcriptWss.handleUpgrade(request, socket, head, (ws) => {
            transcriptClients.add(ws);
            
            ws.on('close', () => {
                transcriptClients.delete(ws);
            });
            
            ws.send(JSON.stringify({ 
                type: "connected",
                message: "Connected to transcript stream",
                timestamp: Date.now()
            }));
        });
    } else {
        socket.destroy();
    }
});

const startRealtimeWSConnection = (plivoWS, requestUuid, phoneNumber, isInbound = true) => {
    console.log(`🎬 START REALTIME WS: Creating for ${isInbound ? 'INBOUND' : 'OUTBOUND'} requestUuid: ${requestUuid}, phone: ${phoneNumber}`);
    
    const realtimeWS = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17', {
        headers: {
            "Authorization": "Bearer " + OPENAI_API_KEY,
            "OpenAI-Beta": "realtime=v1",
        }
    });

    streamCallMap.set(plivoWS, requestUuid);
    plivoWS.realtimeWS = realtimeWS;
    
    let isResponseActive = false;
    let sessionUpdated = false;

    const sendSessionUpdate = () => {
        if (!sessionUpdated) {
            realtimeWS.send(JSON.stringify(SessionUpdate));
            sessionUpdated = true;
            console.log(`📋 SESSION UPDATE: Sent for ${isInbound ? 'inbound' : 'outbound'} requestUuid ${requestUuid}`);
        }
        
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

    realtimeWS.on('open', () => {
        console.log(`✅ OPENAI WEBSOCKET: Connected for ${isInbound ? 'inbound' : 'outbound'} requestUuid ${requestUuid}`);
        setTimeout(() => {
            sendSessionUpdate();
        }, 100);
    });

    realtimeWS.on('close', () => {
        console.log(`❌ OPENAI WEBSOCKET: Disconnected for ${isInbound ? 'inbound' : 'outbound'} requestUuid ${requestUuid}`);
        streamCallMap.delete(plivoWS);
    });

    realtimeWS.on('error', (error) => {
        console.log(`❌ OPENAI WEBSOCKET: Error for ${isInbound ? 'inbound' : 'outbound'} requestUuid ${requestUuid}:`, error);
    });

    realtimeWS.on('message', async (message) => {
        try {
            const response = JSON.parse(message);
            console.log(`📨 OPENAI MESSAGE [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]: Type: ${response.type}`);

            switch (response.type) {
                case 'conversation.item.input_audio_transcription.completed':
                    console.log(`🎤 TRANSCRIPTION [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]: ${response.transcript}`);
                    
                    if (response.transcript && response.transcript.trim()) {
                        const userEntry = {
                            type: 'user',
                            text: response.transcript,
                            timestamp: Date.now(),
                            istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        };
                        
                        console.log(`📝 ADDING USER ENTRY [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]`);
                        await addConversationEntry(requestUuid, userEntry, isInbound);
                    }
                    break;

                case "response.created":
                    isResponseActive = true;
                    console.log(`🤖 AI RESPONSE [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]: Started`);
                    break;

                case "response.done":
                    isResponseActive = false;
                    const outputs = response.response.output;
                    
                    if (outputs.length > 0 && outputs[0].content && outputs[0].content.length > 0) {
                        const transcript = outputs[0].content[0].transcript;
                        console.log(`🤖 AI RESPONSE [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]: ${transcript}`);
                        
                        if (transcript && transcript.trim()) {
                            const aiEntry = {
                                type: 'ai',
                                text: transcript,
                                timestamp: Date.now(),
                                istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                            };
                            
                            console.log(`📝 ADDING AI ENTRY [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]`);
                            await addConversationEntry(requestUuid, aiEntry, isInbound);
                        }
                    }
                    
                    // Function call handling
                    const functionCall = outputs.find(
                        (output) => output.type === "function_call"
                    );
                    
                    if (functionCall && TOOLS[functionCall.name]) {
                        console.log(`🔧 FUNCTION CALL DETECTED [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]:`, functionCall.name);
                        
                        try {
                            let parsedArgs;
                            try {
                                parsedArgs = JSON.parse(functionCall.arguments);
                            } catch (parseError) {
                                const fixedArgs = functionCall.arguments
                                    .replace(/(\w+):/g, '"$1":')
                                    .replace(/'/g, '"');
                                parsedArgs = JSON.parse(fixedArgs);
                            }
                            
                            let phoneNumber = 'Unknown';
                            if (activeCalls.has(requestUuid)) {
                                phoneNumber = activeCalls.get(requestUuid).phoneNumber || 'Unknown';
                            }
                            
                            if (functionCall.name === 'book_appointment') {
                                parsedArgs.phoneNumber = phoneNumber;
                                parsedArgs.requestUuid = requestUuid;
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
                            
                            if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
                                realtimeWS.send(JSON.stringify(conversationItemCreate));
                                console.log(`✅ FUNCTION RESPONSE SENT TO OPENAI: ${functionCall.name}`);
                            }
                            
                            const functionEntry = {
                                type: 'function',
                                function: functionCall.name,
                                arguments: parsedArgs,
                                result: result,
                                timestamp: Date.now(),
                                istTime: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                            };
                            
                            console.log(`📝 ADDING FUNCTION ENTRY [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]`);
                            await addConversationEntry(requestUuid, functionEntry, isInbound);
                            
                            setTimeout(() => {
                                if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
                                    realtimeWS.send(JSON.stringify({ type: "response.create" }));
                                }
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
                            
                            if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
                                realtimeWS.send(JSON.stringify(errorOutput));
                                setTimeout(() => {
                                    realtimeWS.send(JSON.stringify({ type: "response.create" }));
                                }, 100);
                            }
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
            console.error(`❌ OPENAI MESSAGE [${isInbound ? 'INBOUND' : 'OUTBOUND'} ${requestUuid}]: Error:`, error);
        }
    });
    
    return realtimeWS;
};

wss.on('connection', (connection) => {
    let requestUuid = null;
    let phoneNumber = null;
    let isInbound = true;
    let realtimeWS = null;

    connection.on('message', async (message) => {
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
                    
                    let foundCall = null;
                    
                    // Find the most recent call
                    for (let [reqUuid, callInfo] of activeCalls.entries()) {
                        if (Date.now() - callInfo.timestamp < 30000) {
                            foundCall = callInfo;
                            break;
                        }
                    }

                    if (foundCall) {
                        requestUuid = foundCall.requestUuid;
                        phoneNumber = foundCall.phoneNumber;
                        isInbound = foundCall.isInbound !== false;
                        
                        realtimeWS = startRealtimeWSConnection(connection, requestUuid, phoneNumber, isInbound);
                    }
                    break;
            }
        } catch (error) {}
    });

    connection.on('close', async () => {
        if (realtimeWS && realtimeWS.readyState === WebSocket.OPEN) {
            realtimeWS.close();
        }
        
        streamCallMap.delete(connection);
        
        if (requestUuid) {
            await updateCallEnd(requestUuid, isInbound);
            
            setTimeout(() => {
                generateAutoSummary(requestUuid, isInbound);
            }, 2000);
            
            activeCalls.delete(requestUuid);
        }
    });
});

// ==================== SERVER START ====================
async function startServer() {
    try {
        await initializeMongoDB();
        server.listen(PORT, () => {
            console.log(`✅ SERVER STARTED: Listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ SERVER START: Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
app.post('/api/appointments/:appointmentId/confirm', async (request, reply) => {
    if (!appointmentsCollection) {
        return reply.status(500).send({ error: 'Database not configured' });
    }

    try {
        const { appointmentId } = request.params;
        
        const result = await appointmentsCollection.updateOne(
            { _id: new ObjectId(appointmentId) },
            { 
                $set: { 
                    status: 'confirmed',
                    updatedAt: new Date(),
                    confirmedAt: new Date(),
                    confirmedAtIST: getCurrentISTDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return reply.status(404).send({ 
                success: false, 
                error: 'Appointment not found' 
            });
        }
        
        return reply.send({
            success: true,
            message: 'Appointment confirmed successfully'
        });
    } catch (error) {
        return reply.status(500).send({ 
            success: false, 
            error: 'Failed to confirm appointment',
            details: error.message
        });
    }
});