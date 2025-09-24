const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (for MVP)
const users = new Map();
const cycles = new Map();
const sexualActivities = new Map();

// Helper functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
}

function calculatePredictions(userCycles) {
    if (userCycles.length === 0) return null;

    // Calculate average cycle length
    const cycleLengths = userCycles.map(cycle => {
        if (cycle.endDate) {
            return Math.floor((new Date(cycle.endDate) - new Date(cycle.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        }
        return cycle.customCycleLength || 28;
    });

    const avgCycleLength = cycleLengths.reduce((sum, length) => sum + length, 0) / cycleLengths.length;
    
    // Get last cycle
    const lastCycle = userCycles[userCycles.length - 1];
    const lastStart = new Date(lastCycle.startDate);
    
    // Predict next period
    const nextPeriodDate = new Date(lastStart);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + Math.round(avgCycleLength));
    
    // Calculate ovulation (typically 14 days before next period)
    const ovulationDate = new Date(nextPeriodDate);
    ovulationDate.setDate(ovulationDate.getDate() - 14);
    
    // Fertile window (5 days before ovulation to 1 day after)
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 5);
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 1);

    return {
        nextPeriod: nextPeriodDate.toISOString().split('T')[0],
        ovulation: ovulationDate.toISOString().split('T')[0],
        fertileWindow: {
            start: fertileStart.toISOString().split('T')[0],
            end: fertileEnd.toISOString().split('T')[0]
        },
        avgCycleLength: Math.round(avgCycleLength)
    };
}

function calculatePregnancyRisk(activityDate, predictions) {
    if (!predictions) return 'unknown';
    
    const activity = new Date(activityDate);
    const fertileStart = new Date(predictions.fertileWindow.start);
    const fertileEnd = new Date(predictions.fertileWindow.end);
    const ovulation = new Date(predictions.ovulation);
    
    if (activity >= fertileStart && activity <= fertileEnd) {
        // Check if close to ovulation day
        const daysDiff = Math.abs((activity - ovulation) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 1) return 'high';
        if (daysDiff <= 2) return 'medium';
        return 'medium';
    }
    
    return 'low';
}

// Routes

// Authentication routes
app.post('/api/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, mot de passe et nom requis' });
        }

        // Check if user already exists
        for (let [id, user] of users) {
            if (user.email === email) {
                return res.status(400).json({ error: 'Un compte existe déjà avec cet email' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = generateId();
        
        const user = {
            id: userId,
            email,
            name,
            password: hashedPassword,
            cycleLength: 28,
            createdAt: new Date().toISOString()
        };

        users.set(userId, user);
        cycles.set(userId, []);
        sexualActivities.set(userId, []);

        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({
            message: 'Compte créé avec succès',
            token,
            user: { id: userId, email, name, cycleLength: 28 }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        let foundUser = null;
        for (let [id, user] of users) {
            if (user.email === email) {
                foundUser = user;
                break;
            }
        }

        if (!foundUser) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const isValidPassword = await bcrypt.compare(password, foundUser.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign({ userId: foundUser.id, email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            message: 'Connexion réussie',
            token,
            user: {
                id: foundUser.id,
                email: foundUser.email,
                name: foundUser.name,
                cycleLength: foundUser.cycleLength
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// User profile routes
app.get('/api/profile', authenticateToken, (req, res) => {
    const user = users.get(req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        cycleLength: user.cycleLength
    });
});

app.put('/api/profile', authenticateToken, (req, res) => {
    const user = users.get(req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const { name, cycleLength } = req.body;
    
    if (name) user.name = name;
    if (cycleLength && cycleLength >= 21 && cycleLength <= 35) {
        user.cycleLength = cycleLength;
    }

    users.set(req.user.userId, user);
    
    res.json({
        message: 'Profil mis à jour',
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            cycleLength: user.cycleLength
        }
    });
});

// Cycle management routes
app.get('/api/cycles', authenticateToken, (req, res) => {
    const userCycles = cycles.get(req.user.userId) || [];
    const predictions = calculatePredictions(userCycles);
    
    res.json({
        cycles: userCycles,
        predictions
    });
});

app.post('/api/cycles', authenticateToken, (req, res) => {
    const { startDate, endDate, flow, symptoms } = req.body;
    
    if (!startDate) {
        return res.status(400).json({ error: 'Date de début requise' });
    }

    const userCycles = cycles.get(req.user.userId) || [];
    const user = users.get(req.user.userId);
    
    const cycle = {
        id: generateId(),
        startDate,
        endDate: endDate || null,
        flow: flow || 'medium',
        symptoms: symptoms || [],
        customCycleLength: user.cycleLength,
        createdAt: new Date().toISOString()
    };

    userCycles.push(cycle);
    userCycles.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    cycles.set(req.user.userId, userCycles);

    const predictions = calculatePredictions(userCycles);
    
    res.status(201).json({
        message: 'Cycle enregistré',
        cycle,
        predictions
    });
});

app.put('/api/cycles/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { startDate, endDate, flow, symptoms } = req.body;
    
    const userCycles = cycles.get(req.user.userId) || [];
    const cycleIndex = userCycles.findIndex(c => c.id === id);
    
    if (cycleIndex === -1) {
        return res.status(404).json({ error: 'Cycle non trouvé' });
    }

    if (startDate) userCycles[cycleIndex].startDate = startDate;
    if (endDate !== undefined) userCycles[cycleIndex].endDate = endDate;
    if (flow) userCycles[cycleIndex].flow = flow;
    if (symptoms) userCycles[cycleIndex].symptoms = symptoms;

    cycles.set(req.user.userId, userCycles);
    const predictions = calculatePredictions(userCycles);
    
    res.json({
        message: 'Cycle mis à jour',
        cycle: userCycles[cycleIndex],
        predictions
    });
});

app.delete('/api/cycles/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const userCycles = cycles.get(req.user.userId) || [];
    const filteredCycles = userCycles.filter(c => c.id !== id);
    
    if (filteredCycles.length === userCycles.length) {
        return res.status(404).json({ error: 'Cycle non trouvé' });
    }

    cycles.set(req.user.userId, filteredCycles);
    const predictions = calculatePredictions(filteredCycles);
    
    res.json({
        message: 'Cycle supprimé',
        predictions
    });
});

// Sexual activity routes
app.get('/api/sexual-activities', authenticateToken, (req, res) => {
    const activities = sexualActivities.get(req.user.userId) || [];
    res.json({ activities });
});

app.post('/api/sexual-activities', authenticateToken, (req, res) => {
    const { date, protection } = req.body;
    
    if (!date) {
        return res.status(400).json({ error: 'Date requise' });
    }

    const userActivities = sexualActivities.get(req.user.userId) || [];
    const userCycles = cycles.get(req.user.userId) || [];
    const predictions = calculatePredictions(userCycles);
    
    const activity = {
        id: generateId(),
        date,
        protection: protection || false,
        pregnancyRisk: calculatePregnancyRisk(date, predictions),
        createdAt: new Date().toISOString()
    };

    userActivities.push(activity);
    userActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    sexualActivities.set(req.user.userId, userActivities);
    
    res.status(201).json({
        message: 'Activité enregistrée',
        activity
    });
});

app.delete('/api/sexual-activities/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const userActivities = sexualActivities.get(req.user.userId) || [];
    const filteredActivities = userActivities.filter(a => a.id !== id);
    
    if (filteredActivities.length === userActivities.length) {
        return res.status(404).json({ error: 'Activité non trouvée' });
    }

    sexualActivities.set(req.user.userId, filteredActivities);
    
    res.json({ message: 'Activité supprimée' });
});

// Statistics route
app.get('/api/statistics', authenticateToken, (req, res) => {
    const userCycles = cycles.get(req.user.userId) || [];
    
    if (userCycles.length === 0) {
        return res.json({
            totalCycles: 0,
            averageCycleLength: 0,
            averagePeriodLength: 0,
            regularity: 0
        });
    }

    // Calculate cycle lengths
    const cycleLengths = [];
    for (let i = 1; i < userCycles.length; i++) {
        const prevStart = new Date(userCycles[i-1].startDate);
        const currentStart = new Date(userCycles[i].startDate);
        const length = Math.floor((currentStart - prevStart) / (1000 * 60 * 60 * 24));
        cycleLengths.push(length);
    }

    // Calculate period lengths
    const periodLengths = userCycles
        .filter(cycle => cycle.endDate)
        .map(cycle => {
            const start = new Date(cycle.startDate);
            const end = new Date(cycle.endDate);
            return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        });

    const avgCycleLength = cycleLengths.length > 0 
        ? cycleLengths.reduce((sum, length) => sum + length, 0) / cycleLengths.length 
        : 0;

    const avgPeriodLength = periodLengths.length > 0
        ? periodLengths.reduce((sum, length) => sum + length, 0) / periodLengths.length
        : 0;

    // Calculate regularity (percentage of cycles within 2 days of average)
    let regularCycles = 0;
    if (cycleLengths.length > 0) {
        regularCycles = cycleLengths.filter(length => 
            Math.abs(length - avgCycleLength) <= 2
        ).length;
    }
    
    const regularity = cycleLengths.length > 0 
        ? (regularCycles / cycleLengths.length) * 100 
        : 0;

    res.json({
        totalCycles: userCycles.length,
        averageCycleLength: Math.round(avgCycleLength * 10) / 10,
        averagePeriodLength: Math.round(avgPeriodLength * 10) / 10,
        regularity: Math.round(regularity)
    });
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'CycleFem Node.js API' });
});

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
