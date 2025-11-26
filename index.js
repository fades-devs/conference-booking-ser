require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { auth } = require('express-oauth2-jwt-bearer');
const Booking = require('./models/Booking');
const { getForecast, calculateWeatherSurcharge } = require('./utils/weatherLogic');

const app = express();
const port = process.env.PORT || 3003;

// STRIPE WEBHOOK (before body parser)
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        // Fulfill the booking
        try {
            const booking = await Booking.findOne({ stripeSessionId: session.id });
            if (booking) {
                booking.status = 'confirmed';
                await booking.save();
                console.log(`Booking confirmed: ${booking._id}`);
            }
        } catch (err) {
            console.error('Error updating booking:', err);
        }
    }

    res.json({received: true});
});

// MIDDLEWARE
app.use(cors());
app.use(express.json());

const checkJwt = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    tokenSigningAlg: 'RS256'
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('DB Error:', err));

// ROUTES

// Create Booking Session (Pending)
app.post('/api/v1/bookings', checkJwt, async (req, res) => {
    try {
        const { roomId, date } = req.body;
        const userId = req.auth.payload.sub;

        // Get Room Details from Room Service
        // If room service is down (handled in prod)
        const roomResponse = await axios.get(`${process.env.ROOM_SERVICE_URL}/${roomId}`);
        const room = roomResponse.data;

        // Get Weather & Calculate Price
        const weather = getForecast(room.location, date);
        const { surcharge } = calculateWeatherSurcharge(room.basePrice, weather.temperature);

        const finalPrice = room.basePrice + surcharge;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: { 
                        name: `${room.name} (Temp: ${weather.temperature}°C)`,
                        description: `Base: £${room.basePrice} + Weather Charge: £${surcharge}`
                    },
                    unit_amount: Math.round(finalPrice * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/bookings/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/bookings/cancel`,
            client_reference_id: roomId,
        });

        // Save Pending Booking
        const newBooking = new Booking({
            userId,
            roomId,
            roomName: room.name,
            date,
            basePrice: room.basePrice,
            weatherCharge: surcharge,
            finalPrice,
            status: 'pending',
            stripeSessionId: session.id
        });
        await newBooking.save();

        // Return URL to frontend so it can redirect user
        res.json({ checkoutUrl: session.url });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Booking failed' });
    }
});

// Get My Bookings
app.get('/api/v1/bookings/my-bookings', checkJwt, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const bookings = await Booking.find({ userId }).sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel Booking
app.delete('/api/v1/bookings/:id', checkJwt, async (req, res) => {
     try {
        const userId = req.auth.payload.sub;
        await Booking.deleteOne({ _id: req.params.id, userId });
        res.json({ message: 'Booking cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Booking Service running on port ${port}`);
});


// const express = require('express');
// const app = express();
// const port = process.env.PORT || 3003 ; // 3003 for Booking Service

// app.get('/', (req, res) => {
//   res.json({ service: 'Booking Service', status: 'Active' });
// });

// app.listen(port, () => {
//   console.log(`Booking Service running on port ${port}`);
// });